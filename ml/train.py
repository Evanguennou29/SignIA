"""Entraînement causal et évaluation sur des personnes signantes disjointes."""
import argparse
import hashlib
import json
import random
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from schema import FEATURE_SIZE, FPS, WINDOW, SCHEMA, windows

class SignLSTM(nn.Module):
    def __init__(self, classes):
        super().__init__()
        self.lstm = nn.LSTM(FEATURE_SIZE, 96, batch_first=True)
        self.head = nn.Linear(96, classes)
    def forward(self, landmarks):
        sequence, _ = self.lstm(landmarks)
        return self.head(sequence[:, -1])

def validate_splits(config):
    groups = [set(config[k]) for k in ['train_signers','val_signers','test_signers']]
    if any(not g for g in groups) or any(groups[i]&groups[j] for i in range(3) for j in range(i)):
        raise ValueError('Les personnes des trois partitions doivent être distinctes et les partitions non vides')
    classes = config['classes']
    if len(classes)<3 or classes[:2]!=['__rest__','__unknown__'] or len(set(classes))!=len(classes) or any('REMPLACER' in x for x in classes):
        raise ValueError('Classes non validées, repos/inconnu absents ou doublons')

def load_data(root, config):
    validate_splits(config)
    records = json.loads((root/'index.json').read_text(encoding='utf-8'))
    splits = {}
    all_signers=set().union(*(set(config[k]) for k in ['train_signers','val_signers','test_signers']))
    if any(row['signer'] not in all_signers for row in records):
        raise ValueError('Des personnes ne sont affectées à aucune partition')
    for split in ['train','val','test']:
        features, labels = [], []
        for row in records:
            if row['schema']!=SCHEMA or row['label'] not in config['classes'] or not row['license']:
                raise ValueError('Index incompatible ou droits manquants')
            if row['signer'] not in config[split+'_signers']:
                continue
            path=(root/row['file']).resolve()
            if not path.is_relative_to(root.resolve()):
                raise ValueError('Chemin hors dossier de repères')
            with np.load(path, allow_pickle=False) as data:
                chunks=windows(data['features'],data['timestamps'])
            features.extend(chunks)
            labels.extend([config['classes'].index(row['label'])]*len(chunks))
        if not features or set(labels)!=set(range(len(config['classes']))):
            raise ValueError('Chaque partition doit contenir des fenêtres valides pour chaque classe, y compris repos/inconnu')
        splits[split]=TensorDataset(torch.from_numpy(np.stack(features)),torch.tensor(labels))
    return splits

def evaluate(model, dataset, classes):
    matrix=np.zeros((classes,classes),dtype=np.int64)
    model.eval()
    with torch.no_grad():
        for x,y in DataLoader(dataset,batch_size=64):
            predicted=model(x).argmax(1).numpy()
            for truth,pred in zip(y.numpy(),predicted):
                matrix[truth,pred]+=1
    f1=[]
    for i in range(classes):
        tp=matrix[i,i];den=matrix[i,:].sum()+matrix[:,i].sum()
        f1.append(float(2*tp/den) if den else 0.)
    return {'macro_f1':float(np.mean(f1)),'accuracy':float(np.trace(matrix)/matrix.sum()),'confusion_matrix':matrix.tolist(),'per_class_f1':f1,'windows':int(matrix.sum())}

def run(root, config, output):
    random.seed(config['seed']);np.random.seed(config['seed']);torch.manual_seed(config['seed'])
    torch.set_num_threads(2)
    splits=load_data(root,config)
    model=SignLSTM(len(config['classes']))
    counts=torch.bincount(splits['train'].tensors[1],minlength=len(config['classes']))
    loss_fn=nn.CrossEntropyLoss(weight=(1/counts.float()).clamp(max=1))
    optimizer=torch.optim.Adam(model.parameters(),lr=config['learning_rate'])
    best=-1.
    output.mkdir(parents=True,exist_ok=True)
    for epoch in range(config['epochs']):
        model.train()
        for x,y in DataLoader(splits['train'],batch_size=config['batch_size'],shuffle=True):
            optimizer.zero_grad();loss=loss_fn(model(x),y);loss.backward();nn.utils.clip_grad_norm_(model.parameters(),1.);optimizer.step()
        score=evaluate(model,splits['val'],len(config['classes']))['macro_f1']
        if score>best:
            best=score;torch.save(model.state_dict(),output/'best.pt')
        print(f'Epoch {epoch+1}/{config["epochs"]}, validation macro-F1: {score:.4f}')
    model.load_state_dict(torch.load(output/'best.pt',weights_only=True));model.eval()
    report=evaluate(model,splits['test'],len(config['classes']))
    report.update({'schema':SCHEMA,'classes':config['classes'],'train_signers':config['train_signers'],'val_signers':config['val_signers'],'test_signers':config['test_signers'],'seed':config['seed'],'dataset':config['dataset'],'license':config['license'],'scope':'classification de fenêtres de signes isolés ; aucune évaluation de traduction ni de segmentation continue','limitations':'fenêtres corrélées au sein des clips ; pas de mesure de performance sur caméra réelle ; validation linguistique et tests de transitions nécessaires'})
    (output/'evaluation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    torch.onnx.export(model,torch.zeros(1,WINDOW,FEATURE_SIZE),output/'lsf.onnx',input_names=['landmarks'],output_names=['logits'],opset_version=17,dynamo=False)
    import onnxruntime as ort
    session=ort.InferenceSession(str(output/'lsf.onnx'),providers=['CPUExecutionProvider'])
    sample=splits['test'].tensors[0][:1]
    with torch.no_grad():
        expected=model(sample).numpy()
    np.testing.assert_allclose(session.run(None,{'landmarks':sample.numpy()})[0],expected,rtol=1e-4,atol=1e-5)
    manifest={'status':'candidate','language':'LSF','schema':SCHEMA,'model':'/models/lsf.onnx','sha256':hashlib.sha256((output/'lsf.onnx').read_bytes()).hexdigest(),'classes':config['classes'],'window':WINDOW,'fps':FPS,'threshold':config['threshold'],'holdMs':config['hold_ms'],'releaseMs':config['release_ms'],'license':config['license'],'dataset':config['dataset'],'version':config['version'],'evaluation':{'signerIndependent':True,'testSigners':len(config['test_signers']),'macroF1':report['macro_f1'],'report':'/models/evaluation.json'}}
    # L’entraînement seul n’autorise pas la diffusion et ne prouve pas la qualité LSF.
    (output/'recognition.candidate.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ['data','config','output']:
        parser.add_argument('--'+name,required=True,type=Path)
    args=parser.parse_args()
    run(args.data,json.loads(args.config.read_text(encoding='utf-8')),args.output)
