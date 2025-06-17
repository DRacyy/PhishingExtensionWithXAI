from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta, timezone
import os
import json
from dotenv import load_dotenv

load_dotenv()  # Loads variables from .env into os.environ

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure JWT
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')  
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
jwt = JWTManager(app)

# Error handlers
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    print(f"Expired token received: {jwt_payload}")
    return jsonify({
        'success': False,
        'message': 'The token has expired',
        'error': 'token_expired'
    }), 401

@jwt.invalid_token_loader
def invalid_token_callback(error_string):
    print(f"Invalid token received: {error_string}")
    return jsonify({
        'success': False,
        'message': 'Signature verification failed',
        'error': 'invalid_token'
    }), 401

@jwt.unauthorized_loader
def missing_token_callback(error_string):
    print(f"Missing token: {error_string}")
    return jsonify({
        'success': False,
        'message': 'Request does not contain an access token',
        'error': 'authorization_required'
    }), 401

@jwt.needs_fresh_token_loader
def token_not_fresh_callback(jwt_header, jwt_payload):
    print(f"Token not fresh: {jwt_payload}")
    return jsonify({
        'success': False,
        'message': 'The token is not fresh',
        'error': 'fresh_token_required'
    }), 401

# Database connection function
def get_db_connection():
    conn = psycopg2.connect(
        dbname=os.environ.get('DB_NAME', 'shieldscan'),
        user=os.environ.get('DB_USER', 'postgres'),
        password=os.environ.get('DB_PASSWORD', 'postgres'),
        host=os.environ.get('DB_HOST', 'localhost'),
        port=os.environ.get('DB_PORT', '5432')
    )
    conn.autocommit = True
    return conn

# Helper function to log analytics events
def log_analytics_event(user_id, event_type, event_data=None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO analytics (user_id, event_type, event_data) VALUES (%s, %s, %s)",
            (user_id, event_type, json.dumps(event_data) if event_data else None)
        )
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error logging analytics: {e}")
        # Fail silently - don't let analytics errors affect main functionality

# Helper function to get integer user ID from token
def get_user_id_from_token():
    user_id = get_jwt_identity()
    try:
        return int(user_id)
    except (ValueError, TypeError):
        return None

#--------------------------------
# Authentication Routes
#--------------------------------

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Validate input
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({
            'success': False,
            'message': 'Email and password are required'
        }), 400
    
    email = data['email']
    password = data['password']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if user already exists
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({
                'success': False,
                'message': 'User with this email already exists'
            }), 400
        
        # Hash the password
        hashed_password = generate_password_hash(password)
        
        # Insert the new user
        cursor.execute(
            "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING user_id",
            (email, hashed_password)
        )
        user_id = cursor.fetchone()[0]
        
        # Initialize empty user settings
        cursor.execute(
            "INSERT INTO user_settings (user_id) VALUES (%s)",
            (user_id,)
        )
        
        # Log registration event
        log_analytics_event(
            user_id, 
            'user_registered', 
            {'user_agent': request.headers.get('User-Agent')}
        )
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully'
        }), 201
        
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({
            'success': False,
            'message': 'Server error during registration'
        }), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # Validate input
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({
            'success': False,
            'message': 'Email and password are required'
        }), 400
    
    email = data['email']
    password = data['password']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Find the user
        cursor.execute(
            "SELECT user_id, password_hash FROM users WHERE email = %s",
            (email,)
        )
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401
        
        user_id, password_hash = user
        
        # Compare password
        if not check_password_hash(password_hash, password):
            cursor.close()
            conn.close()
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401
        
        # Generate JWT - Convert user_id to string to fix the subject error
        expires = datetime.now(timezone.utc) + timedelta(days=7)
        token = create_access_token(identity=str(user_id))
        
        # Record the login
        cursor.execute(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = %s",
            (user_id,)
        )
        
        # Create session record
        cursor.execute(
            """INSERT INTO sessions 
               (user_id, session_token, expires_at) 
               VALUES (%s, %s, %s)""",
            (user_id, token, expires)
        )
        
        # Log login event
        log_analytics_event(
            user_id, 
            'user_login', 
            {
                'user_agent': request.headers.get('User-Agent'),
                'ip_address': request.remote_addr
            }
        )
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'token': token,
            'userId': user_id,
            'email': email,  # Added email to response
            'expiresAt': int(expires.timestamp() * 1000)  # Convert to milliseconds for JS
        })
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({
            'success': False,
            'message': 'Server error during login'
        }), 500

@app.route('/api/auth/verify', methods=['GET'])
@jwt_required()
def verify_token():
    # If we get here, the token is valid
    user_id = get_user_id_from_token()
    
    try:
        # Log token verification
        log_analytics_event(user_id, 'token_verified')
        
        return jsonify({
            'valid': True,
            'userId': user_id
        })
    except ValueError:
        print(f"Invalid user_id in token: {user_id}")
        return jsonify({
            'valid': False,
            'message': 'Invalid user ID in token'
        }), 401

@app.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    user_id = get_user_id_from_token()
    if user_id is None:
        return jsonify({
            'success': False,
            'message': 'Invalid user ID in token'
        }), 401
    
    try:
        # Invalidate the session
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "UPDATE sessions SET is_active = FALSE WHERE user_id = %s AND is_active = TRUE",
            (user_id,)
        )
        
        # Log logout event
        log_analytics_event(user_id, 'user_logout')
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Logged out successfully'
        })
        
    except Exception as e:
        print(f"Logout error: {e}")
        return jsonify({
            'success': False,
            'message': 'Error during logout'
        }), 500

#--------------------------------
# Settings Routes
#--------------------------------

@app.route('/api/settings', methods=['GET'])
@jwt_required()
def get_settings():
    user_id = get_user_id_from_token()
    if user_id is None:
        return jsonify({
            'success': False,
            'message': 'Invalid user ID in token'
        }), 401
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Fetch user settings
        cursor.execute(
            "SELECT * FROM user_settings WHERE user_id = %s",
            (user_id,)
        )
        result = cursor.fetchone()
        
        if not result:
            # Create default settings if none exist
            default_settings = {
                'url_analysis': True,
                'ml_detection': True,
                'notifications': True,
                'auto_scan': True,
                'show_count': True,
                'whitelist': []
            }
            
            cursor.execute(
                """INSERT INTO user_settings 
                   (user_id, url_analysis, ml_detection, notifications, auto_scan, 
                    show_count, whitelist) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (user_id, default_settings['url_analysis'], default_settings['ml_detection'], 
                 default_settings['notifications'], default_settings['auto_scan'], 
                 default_settings['show_count'], default_settings['whitelist'])
            )
            
            cursor.close()
            conn.close()
            
            # Convert to client format
            client_settings = {
                'urlAnalysis': default_settings['url_analysis'],
                'mlDetection': default_settings['ml_detection'],
                'notifications': default_settings['notifications'],
                'autoScan': default_settings['auto_scan'],
                'showCount': default_settings['show_count'],
                'whitelist': default_settings['whitelist']
            }
            
            # Log settings initialization
            log_analytics_event(user_id, 'settings_initialized', default_settings)
            
            return jsonify({
                'success': True,
                'settings': client_settings
            })
        
        # Convert from DB format to client format
        db_settings = dict(result)
        client_settings = {
            'urlAnalysis': db_settings['url_analysis'],
            'mlDetection': db_settings['ml_detection'],
            'notifications': db_settings['notifications'],
            'autoScan': db_settings['auto_scan'],
            'showCount': db_settings['show_count'],
            'whitelist': db_settings['whitelist'] if db_settings['whitelist'] else []
        }
        
        cursor.close()
        conn.close()
        
        # Log settings retrieval
        log_analytics_event(user_id, 'settings_retrieved')
        
        return jsonify({
            'success': True,
            'settings': client_settings
        })
        
    except Exception as e:
        print(f"Get settings error: {e}")
        return jsonify({
            'success': False,
            'message': 'Server error while retrieving settings'
        }), 500

@app.route('/api/settings', methods=['PUT'])
@jwt_required()
def update_settings():
    user_id = get_user_id_from_token()
    if user_id is None:
        return jsonify({
            'success': False,
            'message': 'Invalid user ID in token'
        }), 401
    
    data = request.get_json()
    
    # Extract settings from request
    url_analysis = data.get('urlAnalysis', True)
    ml_detection = data.get('mlDetection', True)
    notifications = data.get('notifications', True)
    auto_scan = data.get('autoScan', True)
    show_count = data.get('showCount', True)
    whitelist = data.get('whitelist', [])
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Update settings
        cursor.execute(
            """UPDATE user_settings SET 
               url_analysis = %s, 
               ml_detection = %s, 
               notifications = %s, 
               auto_scan = %s, 
               show_count = %s, 
               whitelist = %s,
               updated_at = CURRENT_TIMESTAMP
               WHERE user_id = %s""",
            (url_analysis, ml_detection, notifications, auto_scan, 
             show_count, whitelist, user_id)
        )
        
        cursor.close()
        conn.close()
        
        # Log settings update
        log_analytics_event(
            user_id, 
            'settings_updated', 
            {
                'urlAnalysis': url_analysis,
                'mlDetection': ml_detection,
                'notifications': notifications,
                'autoScan': auto_scan,
                'showCount': show_count,
                'whitelist_count': len(whitelist)
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Settings updated successfully'
        })
        
    except Exception as e:
        print(f"Update settings error: {e}")
        return jsonify({
            'success': False,
            'message': 'Server error while updating settings'
        }), 500

#--------------------------------
# History Routes
#--------------------------------

@app.route('/api/history/sync', methods=['POST'])
@jwt_required()
def sync_history():
    user_id = get_user_id_from_token()
    if user_id is None:
        return jsonify({
            'success': False,
            'message': 'Invalid user ID in token'
        }), 401
    
    data = request.get_json()
    
    print(f"Sync request received for user {user_id}")
    
    if not data or not isinstance(data.get('history'), list):
        print("No history data provided in request or invalid format")
        return jsonify({
            'success': False,
            'message': 'No history data provided or invalid format'
        }), 400
    
    history = data['history']
    print(f"Processing {len(history)} history items")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Track how many items were processed
        new_items_count = 0
        updated_items_count = 0
        
        # Process each history item
        for item in history:
            try:
                # Convert JS timestamp to Python datetime
                scan_date = datetime.fromtimestamp(item['date'] / 1000.0)
                
                print(f"Processing item: URL={item['url']}, Date={scan_date}")
                
                # Check if this URL was scanned within a 5-second window
                cursor.execute(
                    """SELECT scan_id FROM scan_history 
                       WHERE user_id = %s AND url = %s 
                       AND scan_date BETWEEN %s - INTERVAL '5 seconds' AND %s + INTERVAL '5 seconds'""",
                    (user_id, item['url'], scan_date, scan_date)
                )
                existing_scan = cursor.fetchone()
                
                if not existing_scan:
                    # Insert new scan record
                    cursor.execute(
                        """INSERT INTO scan_history 
                           (user_id, url, scan_date, is_safe, threat_type, threat_score) 
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (user_id, item['url'], scan_date, 
                         item.get('isSafe', True),
                         item.get('threatType'),
                         item.get('threatScore'))
                    )
                    new_items_count += 1
                    print(f"Added new history item: {item['url']}")
                else:
                    # Update existing record
                    cursor.execute(
                        """UPDATE scan_history 
                           SET is_safe = %s, threat_type = %s, threat_score = %s
                           WHERE scan_id = %s""",
                        (item.get('isSafe', True),
                         item.get('threatType'),
                         item.get('threatScore'),
                         existing_scan[0])
                    )
                    updated_items_count += 1
                    print(f"Updated existing item: {item['url']}")
                
            except Exception as item_error:
                print(f"Error processing history item: {item_error}")
                print(f"Problematic item: {item}")
                continue
        
        conn.commit()  # Explicitly commit the transaction
        cursor.close()
        conn.close()
        
        # Log sync event
        log_analytics_event(
            user_id, 
            'history_synced', 
            {
                'items_processed': len(history),
                'new_items_added': new_items_count,
                'items_updated': updated_items_count
            }
        )
        
        print(f"Sync completed. Added {new_items_count} new items, updated {updated_items_count} items")
        return jsonify({
            'success': True,
            'message': 'History synchronized successfully',
            'added': new_items_count,
            'updated': updated_items_count
        })
        
    except Exception as e:
        print(f"Sync history error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Server error while syncing history: {str(e)}'
        }), 500

@app.route('/api/history', methods=['GET'])
@jwt_required()
def get_history():
    user_id = get_user_id_from_token()
    if user_id is None:
        return jsonify({
            'success': False,
            'message': 'Invalid user ID in token'
        }), 401
    
    # Get query parameters
    page = request.args.get('page', default=1, type=int)
    items_per_page = request.args.get('limit', default=20, type=int)  # Changed from 50 to 20
    search_term = request.args.get('search', default='', type=str)
    start_date = request.args.get('start_date', type=int)  # Timestamp in milliseconds
    end_date = request.args.get('end_date', type=int)  # Timestamp in milliseconds
    status = request.args.get('status', default='all', type=str)
    sort_by = request.args.get('sort', default='newest', type=str)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Build the WHERE clause
        where_clauses = ["user_id = %s"]
        params = [user_id]
        
        if search_term:
            where_clauses.append("url ILIKE %s")
            params.append(f'%{search_term}%')
        
        if start_date:
            where_clauses.append("scan_date >= to_timestamp(%s / 1000.0)")
            params.append(start_date)
        
        if end_date:
            where_clauses.append("scan_date <= to_timestamp(%s / 1000.0)")
            params.append(end_date)
        
        if status != 'all':
            where_clauses.append("is_safe = %s")
            params.append(status == 'safe')
        
        where_clause = " AND ".join(where_clauses)
        
        # Determine sort order
        sort_clause = {
            'newest': 'scan_date DESC',
            'oldest': 'scan_date ASC',
            'url': 'url ASC'
        }.get(sort_by, 'scan_date DESC')
        
        # Get total count for pagination
        count_query = f"SELECT COUNT(*) FROM scan_history WHERE {where_clause}"
        cursor.execute(count_query, params)
        total_items = cursor.fetchone()[0]
        total_pages = (total_items + items_per_page - 1) // items_per_page
        
        # Get paginated and filtered history
        offset = (page - 1) * items_per_page
        query = f"""
            SELECT * FROM scan_history 
            WHERE {where_clause}
            ORDER BY {sort_clause}
            LIMIT %s OFFSET %s
        """
        cursor.execute(query, params + [items_per_page, offset])
        results = cursor.fetchall()
        
        # Transform to client format
        history = []
        for item in results:
            item_dict = dict(item)
            history.append({
                'id': item_dict['scan_id'],
                'url': item_dict['url'],
                'date': int(item_dict['scan_date'].timestamp() * 1000),
                'isSafe': item_dict['is_safe'],
                'threatType': item_dict['threat_type'],
                'threatScore': float(item_dict['threat_score']) if item_dict['threat_score'] else None
            })
        
        cursor.close()
        conn.close()
        
        # Log history retrieval with filter parameters
        log_analytics_event(
            user_id, 
            'history_retrieved', 
            {
                'page': page, 
                'items_per_page': items_per_page,
                'total_items': total_items,
                'items_returned': len(history),
                'search_term': bool(search_term),
                'date_filtered': bool(start_date or end_date),
                'status_filtered': status != 'all',
                'sort_by': sort_by
            }
        )
        
        return jsonify({
            'success': True,
            'history': history,
            'pagination': {
                'page': page,
                'itemsPerPage': items_per_page,
                'totalItems': total_items,
                'totalPages': total_pages,
                'hasNextPage': page < total_pages,
                'hasPreviousPage': page > 1
            }
        })
        
    except Exception as e:
        print(f"Get history error: {e}")
        return jsonify({
            'success': False,
            'message': 'Server error while retrieving history'
        }), 500

@app.route('/api/history/clear', methods=['POST'])
@jwt_required()
def clear_history():
    user_id = get_user_id_from_token()
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Count how many items will be deleted
        cursor.execute(
            "SELECT COUNT(*) FROM scan_history WHERE user_id = %s",
            (user_id,)
        )
        items_count = cursor.fetchone()[0]
        
        # Delete all history for this user
        cursor.execute(
            "DELETE FROM scan_history WHERE user_id = %s",
            (user_id,)
        )
        
        cursor.close()
        conn.close()
        
        # Log history cleared
        log_analytics_event(
            user_id, 
            'history_cleared', 
            {'items_deleted': items_count}
        )
        
        return jsonify({
            'success': True,
            'message': 'History cleared successfully',
            'deleted': items_count
        })
        
    except Exception as e:
        print(f"Clear history error: {e}")
        return jsonify({
            'success': False,
            'message': 'Server error while clearing history'
        }), 500

#--------------------------------
# URL Scan Routes
#--------------------------------

@app.route('/api/scan', methods=['POST'])
@jwt_required()
def scan_url():
    user_id = get_user_id_from_token()
    if user_id is None:
        return jsonify({
            'success': False,
            'message': 'Invalid user ID in token'
        }), 401
    
    data = request.get_json()
    
    if not data or not data.get('url'):
        return jsonify({
            'success': False,
            'message': 'URL is required'
        }), 400
    
    url = data['url']
    
    try:
        # For now, this is just a stub - you'll integrate your ML model here later
        # Simulating a random scan result
        import random
        is_threat = random.random() < 0.3  # 30% chance of being a threat
        confidence = round(random.uniform(0.7, 0.99), 2)  # Random confidence
        
        # Record the scan in history
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """INSERT INTO scan_history 
               (user_id, url, is_safe, threat_type, threat_score) 
               VALUES (%s, %s, %s, %s, %s)""",
            (user_id, url, not is_threat, 
             "Phishing" if is_threat else None, 
             confidence if is_threat else None)
        )
        
        cursor.close()
        conn.close()
        
        # Log scan event
        log_analytics_event(
            user_id, 
            'url_scanned', 
            {
                'url': url,
                'is_threat': is_threat,
                'confidence': confidence,
                'scan_time_ms': random.randint(50, 500)  # Simulated scan time
            }
        )
        
        # Return scan result
        return jsonify({
            'success': True,
            'url': url,
            'isThreat': is_threat,
            'confidence': confidence,
            'threatType': "Phishing" if is_threat else None
        })
        
    except Exception as e:
        print(f"Scan error: {e}")
        return jsonify({
            'success': False,
            'message': 'Server error during scan'
        }), 500

#--------------------------------
# Dashboard Stats
#--------------------------------

@app.route('/api/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    user_id = get_user_id_from_token()
    if user_id is None:
        return jsonify({
            'success': False,
            'message': 'Invalid user ID in token'
        }), 401
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get total scans
        cursor.execute(
            "SELECT COUNT(*) FROM scan_history WHERE user_id = %s",
            (user_id,)
        )
        total_scans = cursor.fetchone()[0]
        
        # Get threat count
        cursor.execute(
            "SELECT COUNT(*) FROM scan_history WHERE user_id = %s AND is_safe = FALSE",
            (user_id,)
        )
        total_threats = cursor.fetchone()[0]
        
        # Get user registration date
        cursor.execute(
            "SELECT created_at FROM users WHERE user_id = %s",
            (user_id,)
        )
        user_created = cursor.fetchone()[0]
        days_active = (datetime.now() - user_created).days
        
        # Get scans by day (last 7 days)
        cursor.execute(
            """SELECT DATE(scan_date) as scan_day, COUNT(*) 
               FROM scan_history 
               WHERE user_id = %s AND scan_date > CURRENT_DATE - INTERVAL '7 days'
               GROUP BY scan_day 
               ORDER BY scan_day""",
            (user_id,)
        )
        
        daily_scans = []
        for row in cursor.fetchall():
            daily_scans.append({
                'date': row[0].strftime('%Y-%m-%d'),
                'count': row[1]
            })
        
        cursor.close()
        conn.close()
        
        # Log dashboard view
        log_analytics_event(user_id, 'dashboard_viewed')
        
        return jsonify({
            'success': True,
            'stats': {
                'totalScans': total_scans,
                'threats': total_threats,
                'daysActive': days_active,
                'dailyScans': daily_scans
            }
        })
        
    except Exception as e:
        print(f"Dashboard stats error: {e}")
        return jsonify({
            'success': False,
            'message': 'Server error while retrieving dashboard stats'
        }), 500

#--------------------------------
# Analytics Routes (for admin use)
#--------------------------------

@app.route('/api/analytics/events', methods=['GET'])
@jwt_required()
def get_analytics_events():
    user_id = get_user_id_from_token()
    if user_id is None:
        return jsonify({
            'success': False,
            'message': 'Invalid user ID in token'
        }), 401
    
    # Check if user is admin (in a real app, you'd have an admin role)
    # For now, we'll just assume the first user (id=1) is admin
    if user_id != 1:
        return jsonify({
            'success': False,
            'message': 'Unauthorized'
        }), 403
    
    # Get parameters
    event_type = request.args.get('type')
    limit = request.args.get('limit', default=100, type=int)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Build query based on parameters
        query = "SELECT * FROM analytics"
        params = []
        
        if event_type:
            query += " WHERE event_type = %s"
            params.append(event_type)
        
        query += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        results = cursor.fetchall()
        
        # Format result
        events = []
        for event in results:
            events.append({
                'id': event['analytics_id'],
                'userId': event['user_id'],
                'eventType': event['event_type'],
                'eventData': event['event_data'],
                'createdAt': event['created_at'].isoformat()
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'events': events
        })
        
    except Exception as e:
        print(f"Analytics error: {e}")
        return jsonify({
            'success': False,
            'message': 'Server error while retrieving analytics'
        }), 500

# Run the app
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
