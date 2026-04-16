import json
with open('/Users/ido.kazma/Desktop/Projects/private/where2eat/agentic_extractor/6jvskRWvQkg/transcript.json') as f:
    data = json.load(f)
segments = data.get('segments', [])
names = ['שושה', 'שופה', 'שוקה', 'סיקסנסס', 'סיקס', 'שחרות', 'נ26', 'פרנסחנה', 'פרנצ', 'קריאת אונו', 'קריאת', 'קרית', 'דל קרמל', 'קרמל', 'ג\'ורג', 'ג.ורג', 'ליון', 'פרנוי', 'אסה', 'סקבה', 'גייג\'ין', 'גייג', 'קוקו', 'אובי', 'רעיה', 'שמנה', 'חביב', 'חשויה', 'טורטית']
for name in names:
    for i, seg in enumerate(segments):
        if name in seg.get('text', ''):
            start = seg['start']
            mins = int(start // 60)
            secs = int(start % 60)
            print(f'{name}: {mins}:{secs:02d} [{i}]: {seg["text"][:100]}')
