"""Authenticated maintenance, previews and operation history."""
import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from routers.admin import require_role
from database import get_database
from admin_maintenance import Maintenance, Conflict

router=APIRouter(prefix='/api/admin/maintenance',tags=['Admin maintenance'])
admin=Depends(require_role(['admin','super_admin']))
editor=Depends(require_role(['editor','admin','super_admin']))

class MergeRequest(BaseModel):
    keep_id: str=Field(min_length=1)
    drop_id: str=Field(min_length=1)
    revision: str=''

class RevisionRequest(BaseModel):
    revision: str=Field(min_length=1)

class RepairRequest(BaseModel):
    changes: dict[str,Any]
    revision: str=''

def service():return Maintenance(get_database())
def invoke(fn,*args):
    try:return fn(*args)
    except Conflict as e:raise HTTPException(409,str(e)) from e
    except LookupError as e:raise HTTPException(404,str(e)) from e
    except ValueError as e:raise HTTPException(400,str(e)) from e

@router.post('/merges/preview')
def merge_preview(body:MergeRequest,user:dict=editor):
    return invoke(service().preview_merge,body.keep_id,body.drop_id)

@router.post('/merges')
def merge(body:MergeRequest,user:dict=admin):
    return invoke(service().merge,body.keep_id,body.drop_id,body.revision,user['id'])

@router.get('/episodes/{video_id}/delete-preview')
def delete_preview(video_id:str,user:dict=admin):
    return invoke(service().preview_delete,video_id)

@router.delete('/episodes/{video_id}')
def delete_episode(video_id:str,body:RevisionRequest,user:dict=admin):
    return invoke(service().delete_episode,video_id,body.revision,user['id'])

@router.post('/mentions/{mention_id}/preview')
def repair_preview(mention_id:str,body:RepairRequest,user:dict=editor):
    return invoke(service().preview_repair,mention_id,body.changes)

@router.patch('/mentions/{mention_id}')
def repair(mention_id:str,body:RepairRequest,user:dict=editor):
    return invoke(service().repair,mention_id,body.changes,body.revision,user['id'])

@router.get('/operations')
def operations(user:dict=admin):
    s=service()
    with s.db.get_connection() as c:
        return {'operations':[dict(r) for r in c.execute('SELECT id,kind,actor,created_at,undone_at,undone_by FROM maintenance_operations ORDER BY created_at DESC LIMIT 100')]}

@router.get('/operations/{operation_id}')
def operation(operation_id:str,user:dict=admin):
    s=service()
    with s.db.get_connection() as c:
        row=c.execute('SELECT * FROM maintenance_operations WHERE id=?',(operation_id,)).fetchone()
        if not row:raise HTTPException(404,'Operation not found')
        result=dict(row)
        for k in ['before_json','after_json']:result[k]=json.loads(result[k])
        return result

@router.post('/operations/{operation_id}/undo')
def undo(operation_id:str,user:dict=admin):
    return invoke(service().undo,operation_id,user['id'])

@router.get('/costs')
def costs(user:dict=admin):
    from cost_ledger import CostLedger
    return CostLedger().summary()
