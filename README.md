# Seed2Serve

Seed2Serve is an AI-powered cultivation advisory platform for farmers. The main application contains the public website, authentication, a protected farmer dashboard, and links to four specialist recommendation backends.

## Current Architecture

The project has two layers:

1. **Seed2Serve application**
   - Static HTML, CSS, and JavaScript frontend.
   - Node.js and Express server.
   - MySQL database for users, password reset records, and sessions.
   - Runs on port `3000`.

2. **Specialist Django backends**
   - Crop Recommendation and Planning: AGROZONE on port `8000`.
   - Leaf Disease Detection: Leaf Lenz on port `8001`.
   - Yield Estimation and Prediction: yield-estimator on port `8002`.
   - Fertilizer Recommendation: fertilizer_recommendation on port `8003`.

The specialist repositories are separate projects. They should be cloned beside this project, not inside it:

```text
Desktop/
  major project/              # this repository
  AGROZONE/                   # crop recommendation backend
  leaf-lenz/                  # leaf disease backend
  yield-estimator/            # yield prediction backend
  fertilizer_recommendation/  # fertilizer backend
```

## Main Project Structure

```text
index.html              Public Seed2Serve website
login.html              Login and sign-up interface
dashboard.html          Protected farmer dashboard
profile.html            Protected profile page
forgot-password.html    Password reset request page
reset-password.html     Password reset form
server.js               Express server, APIs, sessions, and backend proxy
mailer.js               Password-reset email provider integration
package.json            Node dependencies and scripts
.env.example            Environment variable template
.gitignore              Excludes secrets, dependencies, and logs
assets/                 Logos, product images, slides, and team image
css/                    Page and design-system styles (includes ticket-scanner.css)
js/                     Frontend behavior, product rendering, and ticket-scanner.js
db/seed2serve.sql       Database schema and seed/reference SQL
```

## Soil Test Ticket Scanner & Cross-Port Auto-Fill

Seed2Serve features an automated Soil Test Ticket Scanner directly on the farmer dashboard (`dashboard.html`):
- **Input Methods:** Image file upload (JPG, PNG, WEBP), mobile camera capture, or live desktop webcam.
- **OCR Engine & Canvas Pre-Processing:** High-contrast binarization and $2\times$ upscaling via HTML5 Canvas before Tesseract.js processing, eliminating font bleed and noise on thermal receipts (Arkashine Innovations / SoiLENZ and official Soil Health Cards).
- **Strict Line-by-Line Parsing:** Number extraction bounded by colon separators with zero default/fallback hallucination.
- **Cross-Port Synchronization:** Copies structured `SEED2SERVE_SOIL_DATA:{...}` payloads to the system clipboard and appends URL query strings for instant one-click auto-filling on Crop Recommendation (port `8000`) and Fertilizer Recommendation (port `8003`).

## Requirements

Install these tools before setup:

- Node.js 18 or newer
- npm
- MySQL 8 or compatible MySQL server
- Python 3.8 or newer for the specialist Django backends
- Git

## Seed2Serve Setup

From the project directory:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` with the local MySQL credentials and a long random session secret:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password_here
DB_NAME=seed2serve
SESSION_SECRET=use_a_long_random_secret
COOKIE_SECURE=false
```

Create the database before starting the server. The schema is in `db/seed2serve.sql`:

```sql
CREATE DATABASE seed2serve;
```

Then import the schema using your preferred MySQL client. Example:

```powershell
mysql -u root -p seed2serve < db/seed2serve.sql
```

Start Seed2Serve:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000/
```

`npm start` runs the same server as `npm run dev`.

## Authentication Flow

1. A user visits the public website.
2. Login and sign-up requests go to the Express server:
   - `POST /api/login`
   - `POST /api/register`
3. Passwords are hashed with `bcryptjs` before storage.
4. A successful login creates an HTTP-only session cookie.
5. Sessions are persisted in the MySQL `sessions` table through the custom MySQL session store in `server.js`.
6. The login page checks `GET /api/me` and sends already-authenticated users to `dashboard.html`.
7. The dashboard also checks `GET /api/me` and sends unauthenticated users back to `login.html`.
8. Logout uses `POST /api/logout`.

Other authentication endpoints:

```text
POST /api/auth/google
GET  /api/profile
POST /api/profile/update
POST /api/password/forgot
POST /api/password/reset
GET  /api/config
```

## Dashboard Product Flow

The dashboard product cards are rendered from `js/data/products.js`.

- Clicking a card flips it in place.
- The back face contains a `Get Started` button.
- The hidden face has pointer events disabled so it cannot block the visible face.
- The button currently redirects to the specialist backend for that product.

Current routes:

| Product card | Backend URL |
| --- | --- |
| Crop Recommendation and Planning | `http://127.0.0.1:8000/recommend/` |
| Leaf Disease Detection | `http://127.0.0.1:8001/api/` |
| Yield Estimation and Prediction | `http://127.0.0.1:8002/` |
| Fertilizer Recommendation | `http://127.0.0.1:8003/` |

These redirects are defined in `js/dashboard.js`. Keep the port assignments consistent when starting the specialist services.

## Specialist Backends

### 1. AGROZONE

Repository:

```text
https://github.com/amulyanaik442/AGROZONE
```

Clone and run:

```powershell
Set-Location C:\Users\amuly\Desktop
 git clone https://github.com/amulyanaik442/AGROZONE.git
Set-Location C:\Users\amuly\Desktop\AGROZONE
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py load_crops
.\.venv\Scripts\python.exe manage.py runserver 8000
```

Open the UI at:

```text
http://127.0.0.1:8000/recommend/
```

The REST endpoint is:

```text
POST /api/v1/recommend/
```

The recommendation API requires `ph` and a location. Location can be supplied as latitude and longitude, an Indian state, or a continent and country.

The original AGROZONE UI branding was changed to Seed2Serve in its templates. Its route names and recommendation logic were not changed.

### 2. Leaf Lenz

Repository:

```text
https://github.com/amulyanaik442/leaf-lenz
```

Clone and run:

```powershell
Set-Location C:\Users\amuly\Desktop
 git clone https://github.com/amulyanaik442/leaf-lenz.git
Set-Location C:\Users\amuly\Desktop\leaf-lenz
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver 8001
```

Open the UI at:

```text
http://127.0.0.1:8001/api/
```

Leaf Lenz uses Django and ONNX Runtime. The model assets must remain in the repository, and the service must be running for image diagnosis to work. Its visible branding was changed to Seed2Serve; the `/api/predict/` route and detector logic remain unchanged.

### 3. Yield Estimator

Repository:

```text
https://github.com/madhavihanchate/yield-estimator
```

Clone and run:

```powershell
Set-Location C:\Users\amuly\Desktop
 git clone https://github.com/madhavihanchate/yield-estimator.git
Set-Location C:\Users\amuly\Desktop\yield-estimator
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install django pandas
.\.venv\Scripts\python.exe yield_project\manage.py migrate
.\.venv\Scripts\python.exe yield_project\manage.py runserver 8002
```

Open the UI at:

```text
http://127.0.0.1:8002/
```

The main prediction API is:

```text
GET /api/predict/
```

The application uses bundled output data. Google Earth Engine authentication is optional; without it, the app uses its fallback NDVI behavior described in its own repository documentation.

### 4. Fertilizer Recommendation

Repository:

```text
https://github.com/madhavihanchate/fertilizer_recommendation
```

Clone and run:

```powershell
Set-Location C:\Users\amuly\Desktop
 git clone https://github.com/madhavihanchate/fertilizer_recommendation.git
Set-Location C:\Users\amuly\Desktop\fertilizer_recommendation
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install django openpyxl python-docx
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver 8003
```

Open the UI at:

```text
http://127.0.0.1:8003/
```

This is a rule-based Django application. It reads the included RDF, crop, and fertilizer data files and does not require an ML model.

## Starting Everything

Start each server in a separate PowerShell terminal:

```powershell
# Terminal 1: Seed2Serve
Set-Location C:\Users\amuly\Desktop\major project
npm run dev

# Terminal 2: AGROZONE
& C:\Users\amuly\Desktop\AGROZONE\.venv\Scripts\python.exe C:\Users\amuly\Desktop\AGROZONE\manage.py runserver 8000

# Terminal 3: Leaf Lenz
& C:\Users\amuly\Desktop\leaf-lenz\.venv\Scripts\python.exe C:\Users\amuly\Desktop\leaf-lenz\manage.py runserver 8001

# Terminal 4: Yield estimator
& C:\Users\amuly\Desktop\yield-estimator\.venv\Scripts\python.exe C:\Users\amuly\Desktop\yield-estimator\yield_project\manage.py runserver 8002

# Terminal 5: Fertilizer recommendation
& C:\Users\amuly\Desktop\fertilizer_recommendation\.venv\Scripts\python.exe C:\Users\amuly\Desktop\fertilizer_recommendation\manage.py runserver 8003
```

Quick health checks:

```powershell
Invoke-WebRequest http://localhost:3000/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8000/recommend/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8001/api/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8002/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8003/ -UseBasicParsing
```

Expected status for each page is HTTP `200`.

## Security Notes

- Never commit `.env`, database passwords, email API keys, Google credentials, or private keys.
- `.env` and `node_modules` are excluded by `.gitignore`.
- Use a long random `SESSION_SECRET` outside development.
- Set `COOKIE_SECURE=true` when running behind HTTPS in production.
- The session cookie is HTTP-only and uses `SameSite=Lax`.
- Login passwords are hashed with bcrypt.
- The database-backed session table is created automatically by `server.js`.
- The current Node dependency audit reports zero vulnerabilities with `npm audit`.
- The specialist Django servers are development servers. Use a production WSGI/ASGI deployment and HTTPS before publishing them publicly.
- The current dashboard redirects use localhost addresses and are intended for local development. Production deployment should replace them with configured environment-based URLs.

## Troubleshooting

### Port already in use

Find the process using a port:

```powershell
Get-NetTCPConnection -LocalPort 3000,8000,8001,8002,8003 -State Listen
```

Stop a confirmed stale process:

```powershell
Stop-Process -Id <PID> -Force
```

### Login immediately returns to the dashboard

This means an active session already exists. Click **Log out** from the dashboard, or call:

```powershell
Invoke-WebRequest http://localhost:3000/api/logout -Method Post -UseBasicParsing
```

### Specialist page does not load

Check that the matching Django server is running on the expected port. The Seed2Serve dashboard does not start those services automatically.

### MySQL connection errors

Check the `.env` values, confirm MySQL is running, verify that the `seed2serve` database exists, and confirm that `db/seed2serve.sql` has been imported.

## GitHub

The project is published on the `master` branch:

```text
https://github.com/amulyanaik442/Seed2Serve/tree/master
```

The default GitHub branch may need to be changed to `master` in repository settings if the root repository page does not display the files automatically.
