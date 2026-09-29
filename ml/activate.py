"""Installer uniquement un candidat revu, autorisé et réellement LSF."""
import argparse
import json
import hashlib
import shutil
from pathlib import Path

def activate(source, target, reviewed):
    if not reviewed:
        raise ValueError('Revue linguistique, droits de diffusion et évaluation caméra requis : --reviewed-and-authorized')
    manifest=json.loads((source/'recognition.candidate.json').read_text(encoding='utf-8'))
    if manifest['language']!='LSF' or not manifest['evaluation']['signerIndependent']:
        raise ValueError('Candidat non compatible LSF')
    if hashlib.sha256((source/'lsf.onnx').read_bytes()).hexdigest()!=manifest['sha256']:
        raise ValueError('Poids modifiés')
    target.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source/'lsf.onnx',target/'lsf.onnx')
    shutil.copyfile(source/'evaluation.json',target/'evaluation.json')
    manifest['status']='ready'
    (target/'recognition.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',required=True,type=Path)
    parser.add_argument('--target',required=True,type=Path)
    parser.add_argument('--reviewed-and-authorized',action='store_true')
    args=parser.parse_args()
    activate(args.source,args.target,args.reviewed_and_authorized)
