# 🍽️ Smart QR Menu System

A smart and affordable QR menu and ordering system for small restaurants and street food stalls, built using **Next.js**, **Django**, and **MySQL**.

---

## 🚀 Features

- Vendor registration and menu creation
- Customer QR code scanning and food ordering
- Online payment integration (eSewa)
- Customer reviews and feedback
- Menu item availability updates
- Search, filter, sort, and recommendation features
- Customer loyalty tracking (returning customers and discounts)

---

## 📂 Project Structure

```bash
smart-qr-menu-system/
├── backend/   
    ├── myvenv/     # Python virtual environment
    ├── requirements.txt # Django backend
├── frontend/   # Next.js frontend
├── README.md
└── ...
```

---

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/olrightythen/smart-qr-menu-system.git
cd smart-qr-menu-system
```

### 2. Backend Setup (Django)

#### a. Create and Activate Virtual Environment

```bash
cd backend
python -m venv myvenv
myvenv\Scripts\activate
```

#### b. Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### c. Apply Migrations

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

#### d. Run Django Server

```bash
python manage.py runserver
```

---

### 3. Frontend Setup (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend will be live at [http://localhost:3000](http://localhost:3000)

---

## 📄 Managing Requirements.txt

After installing or updating Python packages in your environment, **update** the `requirements.txt`:

```bash
pip freeze > requirements.txt
```

This ensures the project dependencies are up-to-date!

To install from `requirements.txt`:

```bash
pip install -r requirements.txt
```

---

## 💳 eSewa Payment Integration

- Payment gateway is integrated using **eSewa API**.
- Customers must complete payment before order confirmation.

Set up your test eSewa merchant credentials in the `.env` file.

---

## ⚙️ Technologies Used

![Django](https://img.shields.io/badge/Django-4.2-green)
![Next.js](https://img.shields.io/badge/Next.js-14.0.0-black)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.3-cyan)
![eSewa](https://img.shields.io/badge/eSewa-Integrated-brightgreen)

- **Frontend:** Next.js, TailwindCSS
- **Backend:** Django (Python OOP), Django REST Framework
- **Database:** MySQL
- **Payment Gateway:** eSewa

---

## 📋 Future Improvements

- SMS Notification System for Order Updates 📢
- Table QR Ordering System 🍽️
- Admin Dashboard for Analytics 📊
- Push Notifications 🔔

---

## 🧑‍💻 Author

Made with ❤️ by **Sulav and Suhit**  

---

# ✨ Happy Coding!
