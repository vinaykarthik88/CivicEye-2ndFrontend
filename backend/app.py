from flask import Flask, redirect, url_for, session, request, jsonify
from flask_cors import CORS
from authlib.integrations.flask_client import OAuth
import sqlite3
import os

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'your_secret_key')
CORS(app)

# Google OAuth config
app.config['GOOGLE_CLIENT_ID'] = os.environ.get('GOOGLE_CLIENT_ID', 'YOUR_GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.environ.get('GOOGLE_CLIENT_SECRET', 'YOUR_GOOGLE_CLIENT_SECRET')
app.config['GOOGLE_DISCOVERY_URL'] = (
    'https://accounts.google.com/.well-known/openid-configuration'
)

oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    server_metadata_url=app.config['GOOGLE_DISCOVERY_URL'],
    client_kwargs={
        'scope': 'openid email profile'
    }
)

DATABASE = 'civiceye.db'

def init_db():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        email TEXT UNIQUE,
        google_id TEXT UNIQUE,
        password TEXT
    )''')
    conn.commit()
    conn.close()

init_db()

@app.route('/api/auth/google')
def google_login():
    redirect_uri = url_for('google_callback', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/api/auth/google/callback')
def google_callback():
    token = google.authorize_access_token()
    userinfo = google.parse_id_token(token)
    if not userinfo:
        return redirect('/frontend/login.html?error=google_auth_failed')
    email = userinfo['email']
    google_id = userinfo['sub']
    username = userinfo.get('name', email.split('@')[0])
    # Save or update user in DB
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute('SELECT id FROM users WHERE google_id=? OR email=?', (google_id, email))
    user = c.fetchone()
    if not user:
        c.execute('INSERT INTO users (username, email, google_id) VALUES (?, ?, ?)', (username, email, google_id))
        conn.commit()
    conn.close()
    # Set session and redirect to frontend
    session['user'] = {'username': username, 'email': email, 'google_id': google_id}
    # You may want to set a cookie or return user info to frontend
    return redirect(f'/frontend/login.html?google_success=1&username={username}&email={email}')

@app.route('/api/user', methods=['GET'])
def get_user():
    user = session.get('user')
    if user:
        return jsonify(user)
    return jsonify({'error': 'Not logged in'}), 401

if __name__ == '__main__':
    app.run(debug=True, port=5000)
