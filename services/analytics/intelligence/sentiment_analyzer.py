from textblob import TextBlob

async def analyze_sentiment(text: str) -> dict:
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    subjectivity = blob.sentiment.subjectivity
    
    if polarity > 0.1:
        label = "BULLISH"
    elif polarity < -0.1:
        label = "BEARISH"
    else:
        label = "NEUTRAL"
        
    return {
        "polarity": float(polarity),
        "subjectivity": float(subjectivity),
        "label": label
    }
