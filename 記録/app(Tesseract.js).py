import gspread
from google.oauth2.service_account import Credentials
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Reactからのリクエストを許可

SPREADSHEET_ID = '1CZSXkDPMPCgVawL74UQyXFHP_psmR7HmWYz25eacT6M'
SHEET_NAME = 'data'

def get_questions_from_sheet():
    scopes = [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
    ]
    creds = Credentials.from_service_account_file(
        'config/credentials.json', scopes=scopes)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(SPREADSHEET_ID)
    worksheet = sh.worksheet(SHEET_NAME)
    rows = worksheet.get_all_values()
    questions = []
    # 1行目はヘッダーなので2行目から
    for row in rows[1:]:
        # E列: 問題文, F列: 答え
        if len(row) >= 6 and row[4].strip() and row[5].strip():
            questions.append({
                "question": row[4].strip(),
                "answer": row[5].strip()
            })
    return questions

@app.route('/api/questions')
def get_questions():
    try:
        questions = get_questions_from_sheet()
        return jsonify(questions)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)