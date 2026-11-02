from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import pandas as pd
from datetime import datetime, timedelta
import uuid
import os
import sqlite3
import jwt
from functools import wraps

app = Flask(__name__, static_folder='../frontend')
app.secret_key = 'your-secret-key-change-this-in-production'
CORS(app, supports_credentials=True)

bcrypt = Bcrypt(app)
JWT_SECRET = 'your-jwt-secret-change-this-in-production'

# Database setup
def init_db():
    conn = sqlite3.connect('complaints.db')
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Complaints table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS complaints (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            category TEXT NOT NULL,
            subject TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create default admin user if not exists
    try:
        hashed_password = bcrypt.generate_password_hash('admin123').decode('utf-8')
        cursor.execute('''
            INSERT INTO users (username, password, email, role)
            VALUES (?, ?, ?, ?)
        ''', ('admin', hashed_password, 'admin@complaints.com', 'admin'))
    except sqlite3.IntegrityError:
        pass  # Admin user already exists
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# JWT token helper functions
def generate_token(user_id, username, role):
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        if token.startswith('Bearer '):
            token = token[7:]
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        request.current_user = payload
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        if token.startswith('Bearer '):
            token = token[7:]
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        if payload.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        request.current_user = payload
        return f(*args, **kwargs)
    return decorated

# Database helper functions
def get_db_connection():
    conn = sqlite3.connect('complaints.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/track.html')
def track():
    return send_from_directory('../frontend', 'track.html')

@app.route('/login.html')
def login_page():
    return send_from_directory('../frontend', 'login.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

# Authentication endpoints
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    
    if not username or not password or not email:
        return jsonify({'error': 'Username, password, and email are required'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO users (username, password, email, role)
            VALUES (?, ?, ?, ?)
        ''', (username, hashed_password, email, 'user'))
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'User registered successfully'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 400

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, username, password, email, role FROM users WHERE username = ?', (username,))
    user_data = cursor.fetchone()
    conn.close()
    
    if user_data and bcrypt.check_password_hash(user_data['password'], password):
        token = generate_token(user_data['id'], user_data['username'], user_data['role'])
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': user_data['id'],
                'username': user_data['username'],
                'email': user_data['email'],
                'role': user_data['role']
            }
        }), 200
    
    return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/auth/verify', methods=['POST'])
def verify_token_endpoint():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'authenticated': False}), 200
    
    if token.startswith('Bearer '):
        token = token[7:]
    
    payload = verify_token(token)
    if payload:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': payload['user_id'],
                'username': payload['username'],
                'role': payload['role']
            }
        }), 200
    
    return jsonify({'authenticated': False}), 200

@app.route('/api/complaints', methods=['POST'])
def submit_complaint():
    data = request.json
    complaint_id = str(uuid.uuid4())
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO complaints (id, name, email, phone, category, subject, description, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        complaint_id,
        data.get('name', ''),
        data.get('email', ''),
        data.get('phone', ''),
        data.get('category', ''),
        data.get('subject', ''),
        data.get('description', ''),
        'Pending',
        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    ))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Complaint submitted successfully', 'id': complaint_id}), 201

@app.route('/api/complaints', methods=['GET'])
def get_complaints():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM complaints ORDER BY created_at DESC')
    complaints = cursor.fetchall()
    conn.close()
    
    return jsonify([dict(complaint) for complaint in complaints])

@app.route('/api/complaints/<complaint_id>', methods=['GET'])
def get_complaint(complaint_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM complaints WHERE id = ?', (complaint_id,))
    complaint = cursor.fetchone()
    conn.close()
    
    if complaint:
        return jsonify(dict(complaint))
    return jsonify({'error': 'Complaint not found'}), 404

@app.route('/api/complaints/<complaint_id>', methods=['PUT'])
@token_required
def update_complaint(complaint_id):
    data = request.json
    new_status = data.get('status')
    
    if not new_status:
        return jsonify({'error': 'Status is required'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM complaints WHERE id = ?', (complaint_id,))
    complaint = cursor.fetchone()
    
    if not complaint:
        conn.close()
        return jsonify({'error': 'Complaint not found'}), 404
    
    cursor.execute('''
        UPDATE complaints 
        SET status = ?, updated_at = ?
        WHERE id = ?
    ''', (new_status, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), complaint_id))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Complaint updated successfully'})

@app.route('/api/complaints/export', methods=['GET'])
@token_required
def export_complaints():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM complaints')
    complaints = cursor.fetchall()
    conn.close()
    
    if not complaints:
        return jsonify({'error': 'No complaints to export'}), 400
    
    df = pd.DataFrame([dict(complaint) for complaint in complaints])
    excel_file = 'complaints_export.xlsx'
    df.to_excel(excel_file, index=False)
    
    return send_file(excel_file, as_attachment=True, download_name='complaints_export.xlsx')

@app.route('/api/complaints/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM complaints')
    complaints = cursor.fetchall()
    conn.close()
    
    total = len(complaints)
    pending = len([c for c in complaints if c['status'] == 'Pending'])
    in_progress = len([c for c in complaints if c['status'] == 'In Progress'])
    resolved = len([c for c in complaints if c['status'] == 'Resolved'])
    
    return jsonify({
        'total': total,
        'pending': pending,
        'in_progress': in_progress,
        'resolved': resolved
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
