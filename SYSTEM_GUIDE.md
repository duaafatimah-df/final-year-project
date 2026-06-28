# SpareShare AI - Evaluation & Project Guide (Roman Urdu Version)

Dosto! Ye guide aapke Final Year Project (FYP) Evaluation ke liye banayi gayi hai. Is guide mein hum detail mein cover karenge ke hamara system kya hai, iske features kya hain, kaunsi technology kahan use ho rahi hai, aur code files ka flow kya hai.

---

## Part 1: Mera System Kya Hai? (What is my system in detail?)

**SpareShare AI** aik online resource sharing platform hai jo food waste aur medicines ke safe redistribution ke liye banaya gaya hai. Yeh donors (restaurants, individuals, medical practitioners) aur receivers (NGOs, shelters, community clinics) ke darmiyan aik bridge ka kaam karta hai.

### Key Aspects:
- **Donors** surplus (extra) food ya un-expired medicines donate kar sakte hain.
- **AI Scanning** image se automatically check karti hai ke item safe hai ya nahi, aur uski expiry date aur freshness predict karti hai.
- **Receivers (NGOs)** apni demands post kar sakte hain.
- **AI Matching Recommendation** donors aur NGOs ko automatic match karti hai taake sahi item sahi jagah pohanche.
- **Live Chat** receiver aur donor ko aapas mein pickup arrange karne ke liye direct chatting ki facility deti hai.
- **Trust Scores** ratings and reviews se build hota hai taake fraud aur waste ko block kiya ja sake.

---

## Part 2: System Features & Technologies Used

Hum barabar sab features aur unke peeche jo libraries/models use huway hain unko Roman Urdu mein asan alfaz mein samjhein ge.

### 1. Registration Security & Signup Validation
- **Kya kaam kiya hai code mein?** Regex validation (Regular Expressions) backend `auth.js` aur frontend `Auth.jsx` dono jagah lagaya hai.
- **Yeh technology kya hai?** Regex patterns hotey hain jo string characters ko format ke mutabiq validate karte hain.
- **System mein kaise use ho rahi hai?**
  - Username mein numbers block kiye hain (`/^[a-zA-Z\s]{3,}$/`).
  - Email format ko check kiya jata hai (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
  - Passwords ke checks strict kiye hain (min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char).

### 2. Multi-Image AI Scanning & Classification
- **Kya kaam kiya hai code mein?** Gemini 3.1 Flash Lite API use ki hai. Frontend mein camera aur dropzone ko max 3 images upload karne ke liye upgrade kiya hai.
- **Yeh technology kya hai?** Google Gemini AI aik advanced multimodal model hai jo images ko samajh sakta hai (Vision AI).
- **System mein kaise use ho rahi hai?**
  - Donors up to 3 images (front, back, sides) upload karte hain.
  - API base64 array ko fetch kar ke Gemini system prompt ke sath analyse karti hai.
  - Spoilage, item count, classification safety score aur classification reason return karti hai.

### 3. Expiry Date OCR Extraction
- **Kya kaam kiya hai code mein?** Gemini Vision OCR (Google AI) backend `aiService.js` mein. Fallback: Python FastAPI microservice with Tesseract/EasyOCR.
- **Yeh technology kya hai?** OCR (Optical Character Recognition) tasveer ke andar likhe huway text ko read karne ki capability hai.
- **System mein kaise use ho rahi hai?**
  - Medicine ke cases mein, Gemini OCR expiry formats (e.g. EXP 12/2026) ko parse karta hai.
  - Agar item expired hai ya shelf life < 30 days hai, system listing ko automatically reject kar deta hai.

### 4. Weather-Based Spoilage Enforcement
- **Kya kaam kiya hai code mein?** OpenWeatherMap API + Location distance routing rules.
- **Yeh technology kya hai?** Weather API real-time temperature aur climate metrics details deta hai coordinates ke basis pay.
- **System mein kaise use ho rahi hai?**
  - Agar location ka temperature $\ge 30^\circ\text{C}$ hai (Summer Alert), system food items ki transit limit tight kar deta hai.
  - Delivery time limit 2 hours ho jati hai. Agar dono partners mein driving time > 20 mins hai, system matching block kar deta hai taake khana kharab na ho.

### 5. In-App Coordination Chat System
- **Kya kaam kiya hai code mein?** Express HTTP REST APIs + Mongoose Message Schema + Client-side Polling (every 4 seconds).
- **Yeh technology kya hai?** Polling aik lightweight design pattern hai jo serverless environments (like Vercel) ke liye perfect hai, kyunki web-sockets cold starts aur serverless timeouts pay disconnect ho jate hain.
- **System mein kaise use ho rahi hai?**
  - Jab NGO donor ki request accept karti hai, tab chat option activate hota hai.
  - Aapas mein messages exchange hote hain, jo MongoDB mein store hote hain aur direct coordination aasan banate hain.

### 6. AI Category Forecasting
- **Kya kaam kiya hai code mein?** Custom Aggressive Category-Time Trend Heuristic math formula.
- **Yeh technology kya hai?** Mathematical projections jo historical demand data se future spikes predict karti hain.
- **System mein kaise use ho rahi hai?**
  - Admin view mein har category ki demand projection graph visible hota hai.
  - Formula: $\text{Forecasted Demand} = \text{Active Demands} + (\text{Completed Claims} \times 1.2)$.

### 7. Bilingual Translation Engine
- **Kya kaam kiya hai code mein?** Gemini 2.5 Flash API + translationCache memory dictionary backend mein.
- **Yeh technology kya hai?** Neural Machine Translation jo text ko English se Urdu mein translate karti hai.
- **System mein kaise use ho rahi hai?**
  - Jab user language toggle karta hai, tab system database texts (descriptions, names) ko translate kar ke show karta hai.
  - Server latency save karne ke liye local cache use kiya hai.

---

## Part 3: Code Files and Flow Explanation

### Flow of files, roles, functions:
1. **`backend/server.js`**
   - Express framework setup aur MongoDB Atlas integration file.
   - Server configurations aur routes mapping.

2. **`backend/models/Message.js`**
   - Live chat conversations save karne ka database schema template.

3. **`backend/models/Donation.js`**
   - Donation listings database model (modified to support up to 3 image URLs array).

4. **`backend/routes/auth.js`**
   - User signups, password validations, master OTP (bypass key `123456`) and Apps Script Webhook trigger.

5. **`backend/routes/chats.js`**
   - Live chat REST endpoint APIs for receiving and saving message items.

6. **`backend/routes/donations.js`**
   - Donation endpoints, AI vision classification trigger, weather checks logic implementation.

7. **`backend/utils/aiService.js`**
   - Gemini API connection wrapper layer, translation cache, and fallback engine logic.

8. **`frontend/src/pages/Auth.jsx`**
   - User auth frontend UI dashboard with real-time field error formatting.

9. **`frontend/src/pages/ContributorPortal.jsx`**
   - Donor panel (camera snapshot capturing, dragzone support for 3 images, active thumbnail navigation carousel, inline coordination chat container).

10. **`frontend/src/pages/ReceiverPortal.jsx`**
   - Receiver panel (active NGO requests management, request/history details modal with carousel gallery display, inline coordination chat container).
