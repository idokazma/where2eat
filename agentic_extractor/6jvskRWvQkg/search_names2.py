import json
with open('/Users/ido.kazma/Desktop/Projects/private/where2eat/agentic_extractor/6jvskRWvQkg/transcript.json') as f:
    data = json.load(f)
segments = data.get('segments', [])
names = ['צקולי', 'הריס', 'שפרעם', 'שפרם', 'אטינגר', 'אוגוסט', 'הרמן', 'פת ', 'פוקצ', 'קוקוזן', 'קוקו', 'נקוזן', 'אקוזן', 'מרקוס', 'צדקיהו', 'לוינסקי', 'חגאי', 'יאן', 'אשדוד', 'קיסריה', 'חומוס', 'רפי כהן', 'רפי', 'רפאל', 'דנבר', 'אבד מרי', 'קלנסו', 'קלנס']
for name in names:
    for i, seg in enumerate(segments):
        if name in seg.get('text', ''):
            start = seg['start']
            mins = int(start // 60)
            secs = int(start % 60)
            print(f'{name}: {mins}:{secs:02d} [{i}]: {seg["text"][:100]}')
