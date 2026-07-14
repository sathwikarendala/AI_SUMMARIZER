
from services.summarizer import summarize_text
text = ('This is a long enough sample text for summarization testing. '
        'It should contain at least fifty characters so the API accepts it. '
        'We are checking the website summary feature behavior with a normal request. ') * 2
result = summarize_text(text, model_name='t5-small', length_mode='short')
print(result)
