# Veritascan - AI-Powered Chatbot for Fake News Verification with AI-Generated Content Detection

## Description
Veritascan is an AI-powered fake news detection and media verification platform designed to identify misinformation in real time. The system analyzes text, URLs, images, and media content using AI and trusted live sources to provide credibility reports and fact-checking results.

## Features
- Fake news detection and credibility analysis
- AI-powered media and image analysis
- Real-time scanning of news sources
- Source verification and credibility checking
- Explainable AI verdicts with confidence scores
- Related news and reference suggestions
- Voice interaction support
- Responsive modern web interface
- AI-generated content detection
- Multi-input support (Text, URL, Image, Document, Voice)

## Technologies Used
- JavaScript (Node.js)
- Express.js
- HTML5
- CSS3
- REST API integration
- News API / Fact-checking APIs

## How to Run
1. Clone or download the project repository.

2. Open the project folder.

3. Navigate to the backend folder:

```bash
cd chatbot/backend
```

4. Install dependencies:

```bash
npm install
```

5. Start the backend server:

```bash
node server.js
```

6. Open the frontend folder:

```bash
chatbot/frontend/html
```

7. Open `index.html` in your browser.

## Usage
1. Open the Veritascan website.
2. Paste a news article, URL, or upload an image/document.
3. Click the verify or scan button.
4. The AI system will analyze the content using trusted sources.
5. View the credibility report, confidence score, and related references.

### Example

#### Input
```text
https://sample-news.com/article
```

#### Output
```text
Credibility Score: 92%
Verdict: Potentially Misleading
Sources Checked: Google Fact Check, Wikipedia, NewsAPI
AI Detection: AI-generated image detected
```

## Project Structure

```bash
chatbot/
│
├── backend/
│   ├── node_modules/
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
│
├── frontend/
│   ├── html/
│   ├── scripts/
│   └── styles/
│
└── img/
```

## License
MIT License
