# Laravel + React Authentication with 2FA

Sistema di autenticazione completo con Laravel backend e React frontend, incluso supporto per l'autenticazione a due fattori (2FA).

## Caratteristiche

- ✅ Login/Logout
- ✅ Autenticazione con Sanctum
- ✅ Autenticazione a due fattori con QR code
- ✅ Dashboard utente
- ✅ API RESTful
- ✅ Logging dettagliato
- ✅ Interfaccia utente responsiva

## Struttura del Progetto

```
login/
├── Backend Laravel (API)
│   ├── app/Http/Controllers/
│   │   ├── AuthController.php
│   │   └── TwoFactorAuthController.php
│   └── routes/api.php
└── react/
    ├── src/
    │   ├── components/
    │   │   ├── LoginForm.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── TwoFactorModal.jsx
    │   │   └── TwoFactorSetup.jsx
    │   ├── contexts/AuthContext.jsx
    │   └── services/api.js
    └── package.json
```

## Installazione e Avvio

### Backend Laravel

1. Installa le dipendenze:
```bash
composer install
```

2. Copia il file environment:
```bash
copy .env.example .env
```

3. Genera la chiave dell'applicazione:
```bash
php artisan key:generate
```

4. Esegui le migrazioni:
```bash
php artisan migrate:fresh --seed
```

5. Avvia il server di sviluppo:
```bash
php artisan serve
```

Il backend sarà disponibile su `http://localhost:8000`

### Frontend React

1. Naviga nella cartella React:
```bash
cd react
```

2. Installa le dipendenze:
```bash
npm install
```

3. Avvia il server di sviluppo:
```bash
npm run dev
```

Il frontend sarà disponibile su `http://localhost:5173`

## API Endpoints

### Autenticazione
- `POST /api/login` - Login utente
- `POST /api/logout` - Logout utente
- `GET /api/user` - Ottieni dati utente corrente

### Two Factor Authentication
- `POST /api/two-factor/enable` - Abilita 2FA
- `POST /api/two-factor/disable` - Disabilita 2FA
- `POST /api/two-factor/confirm` - Conferma setup 2FA
- `POST /api/verify-two-factor` - Verifica codice 2FA
- `GET /api/two-factor/qr-code` - Ottieni QR code
- `POST /api/two-factor/recovery-codes` - Genera nuovi codici di recupero

## Utilizzo

### Login Standard
1. Accedi a `http://localhost:5173`
2. Inserisci email e password
3. Clicca "Sign In"

### Setup Two Factor Authentication
1. Accedi alla dashboard
2. Clicca "Enable 2FA"
3. Scansiona il QR code con un'app authenticator (Google Authenticator, Authy, etc.)
4. Inserisci il codice a 6 cifre per confermare
5. Salva i codici di recupero

### Login con 2FA
1. Inserisci email e password normalmente
2. Quando richiesto, inserisci il codice a 6 cifre dall'app authenticator
3. Accesso completato

## Logging

L'applicazione include logging dettagliato per debugging:

- **Frontend**: Console del browser con prefissi per ogni servizio/componente
- **Backend**: Log di Laravel per tracking delle operazioni

Esempio di log frontend:
```
[AuthService] Attempting login for: user@example.com
[API] Request: POST /api/login
[API] Response: 200
[AuthContext] Login completed successfully
```

## Sicurezza

- Uso di Sanctum per l'autenticazione API
- CORS configurato per il frontend React
- Rate limiting su login e 2FA
- Crittografia dei secret 2FA
- Gestione sicura dei codici di recupero

## Personalizzazione

### Modificare l'URL del backend
Modifica `API_BASE_URL` in `react/src/services/api.js`

### Aggiungere nuovi endpoint
1. Crea il metodo nel controller Laravel
2. Aggiungi la rotta in `routes/api.php`
3. Aggiungi il metodo corrispondente in `react/src/services/api.js`

### Modificare gli stili
I file CSS sono modulari e si trovano nella cartella `react/src/components/`

## Troubleshooting

### Errori CORS
Verifica che il middleware CORS sia configurato in `bootstrap/app.php`

### Errori di autenticazione
1. Controlla che Sanctum sia configurato correttamente
2. Verifica che il token sia salvato nel localStorage
3. Controlla i log del browser per errori API

### Problemi con 2FA
1. Sincronizza l'orario del dispositivo
2. Verifica che l'app authenticator sia configurata correttamente
3. Usa i codici di recupero se necessario
