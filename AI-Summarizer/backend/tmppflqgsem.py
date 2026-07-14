
from transformers import pipeline
print('tasks', pipeline.task_templates().keys() if hasattr(pipeline, 'task_templates') else 'no task_templates')
for task in ['text-generation', 'text2text-generation', 'summarization']:
    try:
        pipe = pipeline(task, model='t5-small', device=-1)
        print('pipeline', task, 'OK')
        out = pipe('summarize: This is a test for summarization.', max_new_tokens=50, do_sample=False)
        print('output', out)
    except Exception as e:
        print('pipeline', task, 'ERR', type(e).__name__, e)
