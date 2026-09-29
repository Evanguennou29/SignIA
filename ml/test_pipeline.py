"""Données synthétiques : tests du logiciel uniquement, aucune performance LSF."""
import unittest
import numpy as np
from schema import normalize, windows, FEATURE_SIZE

class SchemaTests(unittest.TestCase):
    def test_parity_and_missing(self):
        pose=[{'x':.4 if i==11 else .6 if i==12 else .5,'y':.5,'visibility':1} for i in range(33)]
        f=normalize({'left':[{'x':.4,'y':.6}],'pose':pose})
        np.testing.assert_allclose(f[:3],[-.5,.5,1])
        np.testing.assert_equal(f[63:66],[0,0,0])
        self.assertEqual(len(f),FEATURE_SIZE)
        self.assertFalse(normalize({}).any())
    def test_window_causality_and_gap(self):
        x=np.ones((40,FEATURE_SIZE),np.float32)
        t=np.arange(40)*1000/15
        self.assertEqual(windows(x,t).shape,(9,32,FEATURE_SIZE))
        x[10]=0
        self.assertEqual(len(windows(x,t)),0)
        with self.assertRaises(ValueError):
            windows(x,np.zeros(40))

class TrainTests(unittest.TestCase):
    def test_end_to_end_candidate_stays_inactive(self):
        import tempfile
        import json
        from pathlib import Path
        from train import run
        from activate import activate
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);data=root/'features';data.mkdir()
            records=[]
            for signer in ['train','val','test']:
                for label in ['__rest__','__unknown__','SOFTWARE_TEST_ONLY']:
                    name=signer+label+'.npz'
                    rng=np.random.default_rng(42)
                    np.savez_compressed(data/name,features=rng.normal(size=(40,FEATURE_SIZE)).astype(np.float32),timestamps=np.arange(40)*1000/15)
                    records.append({'file':name,'signer':signer,'label':label,'license':'SYNTHETIC_SOFTWARE_TEST','schema':'signia-xy-mask-v1'})
            (data/'index.json').write_text(json.dumps(records),encoding='utf-8')
            config={'seed':42,'classes':['__rest__','__unknown__','SOFTWARE_TEST_ONLY'],'train_signers':['train'],'val_signers':['val'],'test_signers':['test'],'epochs':1,'batch_size':32,'learning_rate':.001,'threshold':.85,'hold_ms':500,'release_ms':450,'dataset':'SYNTHETIC_NON_LSF','license':'SOFTWARE_TEST_ONLY','version':'test'}
            run(data,config,root/'output')
            candidate=json.loads((root/'output'/'recognition.candidate.json').read_text(encoding='utf-8'))
            self.assertEqual(candidate['status'],'candidate')
            self.assertFalse((root/'output'/'recognition.json').exists())
            with self.assertRaises(ValueError):
                activate(root/'output',root/'public',False)

    def test_person_leak_rejected(self):
        from train import validate_splits
        with self.assertRaises(ValueError):
            validate_splits({'train_signers':['a'],'val_signers':['b'],'test_signers':['a'],'classes':['__rest__','__unknown__','test']})
    def test_tensor_and_export(self):
        import tempfile
        import torch
        import onnxruntime as ort
        from pathlib import Path
        from train import SignLSTM
        model=SignLSTM(3).eval()
        sample=torch.zeros(1,32,FEATURE_SIZE)
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'synthetic.onnx'
            torch.onnx.export(model,sample,path,input_names=['landmarks'],output_names=['logits'],opset_version=17,dynamo=False)
            result=ort.InferenceSession(str(path),providers=['CPUExecutionProvider']).run(None,{'landmarks':sample.numpy()})[0]
            with torch.no_grad():
                np.testing.assert_allclose(result,model(sample).numpy(),rtol=1e-4,atol=1e-5)

if __name__=='__main__':
    unittest.main()
