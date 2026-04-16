import json

with open('/Users/ido.kazma/Desktop/Projects/private/where2eat/agentic_extractor/wlCpj1zPzEA/transcript.json') as f:
    data = json.load(f)

segments = data.get('segments', [])

with open('/Users/ido.kazma/Desktop/Projects/private/where2eat/agentic_extractor/wlCpj1zPzEA/transcript_formatted.txt', 'w') as out:
    out.write(f"Total segments: {len(segments)}\n")
    out.write(f"Duration: {segments[-1]['start']:.0f}s = {int(segments[-1]['start']//60)}:{int(segments[-1]['start']%60):02d}\n\n")
    for i, s in enumerate(segments):
        mins = int(s['start'] // 60)
        secs = int(s['start'] % 60)
        out.write(f"[{i}] {mins}:{secs:02d} | {s['text']}\n")
