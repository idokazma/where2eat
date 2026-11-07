"""Audited SQLite maintenance. All previews are optimistic concurrency tokens.

Snapshots live in the same SQLite transaction as the mutation. Undo refuses any
later edit to affected rows rather than overwriting another administrator's work.
"""
import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone

class Conflict(ValueError):
    pass

class Maintenance:
    def __init__(self, db):
        self.db = db
        with db.get_connection() as c:
            c.execute('''CREATE TABLE IF NOT EXISTS maintenance_operations (
                id TEXT PRIMARY KEY, kind TEXT NOT NULL, actor TEXT NOT NULL,
                created_at TEXT NOT NULL, before_json TEXT NOT NULL,
                after_json TEXT NOT NULL, undone_at TEXT, undone_by TEXT)''')
            cols={r['name'] for r in c.execute('PRAGMA table_info(episode_mentions)')}
            if 'original_name_hebrew' not in cols:
                try:c.execute('ALTER TABLE episode_mentions ADD COLUMN original_name_hebrew TEXT')
                except sqlite3.OperationalError:
                    # A concurrent process may have completed the same migration.
                    if 'original_name_hebrew' not in {r['name'] for r in c.execute('PRAGMA table_info(episode_mentions)')}:raise

    @staticmethod
    def _rows(c, table, where, args):
        return [dict(r) for r in c.execute(f'SELECT * FROM {table} WHERE {where} ORDER BY id', args)]

    @staticmethod
    def _revision(rows):
        return hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

    def _merge_state(self, c, keep, drop):
        if keep==drop: raise ValueError('Distinct restaurant IDs required')
        rows=self._rows(c,'restaurants','id IN (?,?)',(keep,drop))
        if len(rows)!=2: raise LookupError('Restaurant not found')
        if any(r['is_hidden'] for r in rows): raise Conflict('Both restaurants must be visible')
        return {'restaurants':rows,'episode_mentions':self._rows(c,'episode_mentions','restaurant_id IN (?,?) OR (restaurant_id IS NULL AND google_place_id IN (SELECT google_place_id FROM restaurants WHERE id IN (?,?) AND google_place_id IS NOT NULL))',(keep,drop,keep,drop))}

    def _merge_preview(self,c,keep,drop):
        state=self._merge_state(c,keep,drop);a,b=[next(r for r in state['restaurants'] if r['id']==i) for i in [keep,drop]]
        warnings=[]
        for key in ['google_place_id','city','address']:
            if a.get(key) and b.get(key) and a[key]!=b[key]: warnings.append(f'Conflicting {key}')
        mentions=state['episode_mentions']
        if b.get('mention_timestamp') is not None:
            if not any(m['video_id']==b.get('video_id') and m.get('timestamp_seconds')==b['mention_timestamp'] for m in mentions):
                warnings.append('Drop row has a source timestamp absent from episode_mentions')
        return {'revision':self._revision(state),'rows':state,'warnings':warnings,'impact':{'mentions_moved':sum(m['restaurant_id']!=keep for m in mentions),'rows_hidden':1}}

    def preview_merge(self,keep,drop):
        with self.db.get_connection() as c:return self._merge_preview(c,keep,drop)

    def _record(self,c,kind,actor,before,after):
        oid=str(uuid.uuid4())
        c.execute('INSERT INTO maintenance_operations(id,kind,actor,created_at,before_json,after_json) VALUES(?,?,?,?,?,?)',
                  (oid,kind,actor,datetime.now(timezone.utc).isoformat(),json.dumps(before,ensure_ascii=False),json.dumps(after,ensure_ascii=False)))
        return {'operation_id':oid,'snapshot_saved':True}

    @staticmethod
    def _check(preview,revision):
        if preview['revision']!=revision:raise Conflict('Data changed since preview; preview again')

    def merge(self,keep,drop,revision,actor):
        with self.db.get_connection() as c:
            c.execute('BEGIN IMMEDIATE');p=self._merge_preview(c,keep,drop);self._check(p,revision)
            if p['warnings']:raise Conflict('; '.join(p['warnings']))
            before=p['rows']
            c.execute('UPDATE episode_mentions SET restaurant_id=? WHERE restaurant_id=? OR (restaurant_id IS NULL AND google_place_id IN (SELECT google_place_id FROM restaurants WHERE id IN (?,?) AND google_place_id IS NOT NULL))',(keep,drop,keep,drop))
            c.execute('UPDATE restaurants SET is_hidden=1 WHERE id=?',(drop,))
            after=self._read_same(c,before)
            return self._record(c,'merge',actor,before,after)

    def _delete_preview(self,c,video_id):
        ep=self._rows(c,'episodes','video_id=?',(video_id,))
        if not ep:raise LookupError('Episode not found')
        eid=ep[0]['id']
        rs=self._rows(c,'restaurants','episode_id=?',(eid,))
        # Include mentions outside this episode that must protect shared restaurants.
        ms=self._rows(c,'episode_mentions','episode_id=? OR restaurant_id IN (SELECT id FROM restaurants WHERE episode_id=?) OR google_place_id IN (SELECT google_place_id FROM restaurants WHERE episode_id=? AND google_place_id IS NOT NULL)',(eid,eid,eid))
        shared={r['id'] for r in rs if any(m['episode_id']!=eid and (m['restaurant_id']==r['id'] or (r.get('google_place_id') and m.get('google_place_id')==r['google_place_id'])) for m in ms)}
        for m in ms:
            if m['episode_id']!=eid and not c.execute('SELECT 1 FROM episodes WHERE id=?',(m['episode_id'],)).fetchone():
                raise Conflict('Shared mention has no surviving episode; repair it before deleting')
        queue=self._rows(c,'video_queue','episode_id=? OR video_id=?',(eid,video_id))
        if any(q['status'] in {'queued','processing'} for q in queue):
            raise Conflict('Episode is queued or processing; stop it before deleting')
        jobs=self._rows(c,'jobs','current_video_id=? OR video_url=? OR video_url=?',(video_id,'https://www.youtube.com/watch?v='+video_id,'https://youtu.be/'+video_id))
        if any(j['status'] in {'pending','queued','processing','running'} for j in jobs):
            raise Conflict('Episode has an active processing job; stop it before deleting')
        edits=self._rows(c,'restaurant_edits','restaurant_id IN (SELECT id FROM restaurants WHERE episode_id=?)',(eid,))
        state={'episodes':ep,'restaurants':rs,'episode_mentions':ms,'video_queue':queue,'restaurant_edits':edits,'jobs':jobs}
        return {'revision':self._revision(state),'rows':state,'warnings':[], 'impact':{'episode_id':eid,'mentions_deleted':sum(m['episode_id']==eid for m in ms),'restaurants_deleted':[r['id'] for r in rs if r['id'] not in shared],'restaurants_preserved':[r['id'] for r in rs if r['id'] in shared]}}

    def preview_delete(self,video_id):
        with self.db.get_connection() as c:return self._delete_preview(c,video_id)

    def delete_episode(self,video_id,revision,actor):
        with self.db.get_connection() as c:
            c.execute('BEGIN IMMEDIATE');p=self._delete_preview(c,video_id);self._check(p,revision)
            before=p['rows'];eid=p['impact']['episode_id']
            for rid in p['impact']['restaurants_preserved']:
                r=next(r for r in before['restaurants'] if r['id']==rid)
                replacement=next(m for m in before['episode_mentions'] if m['episode_id']!=eid and (m['restaurant_id']==rid or (r.get('google_place_id') and m.get('google_place_id')==r['google_place_id'])))
                c.execute('UPDATE restaurants SET episode_id=?,video_id=?,video_url=?,mention_timestamp=? WHERE id=?',(replacement['episode_id'],replacement['video_id'],'https://www.youtube.com/watch?v='+replacement['video_id'],replacement['timestamp_seconds'],rid))
            c.execute('DELETE FROM episode_mentions WHERE episode_id=?',(eid,))
            c.execute('UPDATE video_queue SET episode_id=NULL WHERE episode_id=?',(eid,))
            # Keep audit history, detaching only rows whose restaurant is deleted.
            for rid in p['impact']['restaurants_deleted']:
                c.execute('UPDATE restaurant_edits SET restaurant_id=NULL WHERE restaurant_id=?',(rid,))
                c.execute('DELETE FROM restaurants WHERE id=?',(rid,))
            c.execute('DELETE FROM episodes WHERE id=?',(eid,))
            return self._record(c,'delete_episode',actor,before,self._read_same(c,before))

    def _repair_preview(self,c,mid,changes):
        timestamp_only = set(changes) == {'timestamp_seconds'}
        if 'timestamp_seconds' in changes:
            if not timestamp_only:
                raise ValueError('Timestamp corrections must be a standalone change')
            value = changes['timestamp_seconds']
            if type(value) is not int or not 0 <= value <= 604800:
                raise ValueError('Timestamp must be an integer between 0 and 604800 seconds')
        allowed={'restaurant_id','name_hebrew','name_english','verdict','mention_level','status','city','cuisine_type','host_opinion','timestamp_seconds'}
        if any(v is not None and not isinstance(v,str) for k,v in changes.items() if k != 'timestamp_seconds'):raise ValueError('Repair values must be strings or null')
        if not changes or set(changes)-allowed:raise ValueError('Unsupported repair fields; source quotes are immutable')
        if 'name_hebrew' in changes and not str(changes['name_hebrew'] or '').strip():raise ValueError('Name must not be empty')
        if 'verdict' in changes and changes['verdict'] not in {'add_to_page','reference_only','rejected'}:raise ValueError('Invalid verdict')
        target=[]
        if changes.get('restaurant_id'):
            rows=self._rows(c,'restaurants','id=?',(changes['restaurant_id'],))
            if not rows or rows[0]['is_hidden']:raise ValueError('Target restaurant must exist and be visible')
            target=rows
        rows=self._rows(c,'episode_mentions','id=?',(mid,))
        if not rows:raise LookupError('Mention not found')
        state={'episode_mentions':rows}
        return {'rows':state,'revision':self._revision({'state':state,'changes':changes,'target':target}),'changes':changes,'target_restaurant':target}

    def preview_repair(self,mid,changes):
        with self.db.get_connection() as c:return self._repair_preview(c,mid,changes)

    def repair(self,mid,changes,revision,actor):
        with self.db.get_connection() as c:
            c.execute('BEGIN IMMEDIATE');p=self._repair_preview(c,mid,changes);self._check(p,revision);before=p['rows']
            if set(changes) != {'timestamp_seconds'}:
                c.execute('UPDATE episode_mentions SET original_name_hebrew=COALESCE(original_name_hebrew,name_hebrew) WHERE id=?',(mid,))
            for key,value in changes.items():c.execute(f'UPDATE episode_mentions SET {key}=? WHERE id=?',(value,mid))
            if set(changes) == {'timestamp_seconds'}:
                ts=changes['timestamp_seconds']
                c.execute('UPDATE episode_mentions SET timestamp_display=? WHERE id=?',(f'{ts//60}:{ts%60:02d}',mid))
            return self._record(c,'repair_mention',actor,before,self._read_same(c,before))

    def _read_same(self,c,state):
        return {table:[dict(row) for old in rows for row in c.execute(f'SELECT * FROM {table} WHERE id=?',(old['id'],))] for table,rows in state.items()}

    def undo(self,oid,actor):
        with self.db.get_connection() as c:
            c.execute('BEGIN IMMEDIATE');op=c.execute('SELECT * FROM maintenance_operations WHERE id=?',(oid,)).fetchone()
            if not op:raise LookupError('Operation not found')
            if op['undone_at']:raise Conflict('Operation already undone')
            before=json.loads(op['before_json']);after=json.loads(op['after_json'])
            if self._read_same(c,before)!=after:raise Conflict('Affected rows changed after operation; automatic undo refused')
            # Refuse new linked rows that would make restoration silently inconsistent.
            if op['kind'] in {'merge','delete_episode'}:
                rids=[r['id'] for r in before.get('restaurants',[])]
                if rids:
                    marks=','.join('?' for _ in rids)
                    place_ids=[r['google_place_id'] for r in before.get('restaurants',[]) if r.get('google_place_id')]
                    clause=f'restaurant_id IN ({marks})'
                    args=list(rids)
                    if place_ids:
                        clause+=' OR google_place_id IN ('+','.join('?' for _ in place_ids)+')'
                        args+=place_ids
                    current=self._rows(c,'episode_mentions',clause,tuple(args))
                    known={m['id'] for m in after.get('episode_mentions',[])}
                    if any(m['id'] not in known for m in current):raise Conflict('New linked mentions prevent undo')
                for ep in before.get('episodes',[]):
                    if c.execute('SELECT 1 FROM episodes WHERE video_id=? AND id!=?',(ep['video_id'],ep['id'])).fetchone():raise Conflict('Episode was re-created; undo refused')
                    known={q['id'] for q in after.get('video_queue',[])}
                    queue=self._rows(c,'video_queue','video_id=?',(ep['video_id'],))
                    if any(q['id'] not in known for q in queue):raise Conflict('New queue activity prevents undo')
                    jobs=self._rows(c,'jobs','current_video_id=? OR video_url=? OR video_url=?',(ep['video_id'],'https://www.youtube.com/watch?v='+ep['video_id'],'https://youtu.be/'+ep['video_id']))
                    if any(j['id'] not in {old['id'] for old in after.get('jobs',[])} for j in jobs):raise Conflict('New processing job prevents undo')
            for table in ['episodes','restaurants','episode_mentions','video_queue','restaurant_edits']:
                for row in before.get(table,[]):
                    cols=list(row);values=list(row.values());marks=','.join('?' for _ in cols)
                    # UPSERT, not REPLACE: preserve FK identity.
                    updates=','.join(f'{k}=excluded.{k}' for k in cols if k!='id')
                    c.execute(f"INSERT INTO {table} ({','.join(cols)}) VALUES({marks}) ON CONFLICT(id) DO UPDATE SET {updates}",values)
            c.execute('UPDATE maintenance_operations SET undone_at=?,undone_by=? WHERE id=?',(datetime.now(timezone.utc).isoformat(),actor,oid))
            return {'operation_id':oid,'undone':True}
