# Fraud Detection Confidence Breakdown System

## 📊 Overview

The Fraud Confidence Breakdown system provides a comprehensive, multi-layered approach to fraud detection with visual confidence scoring. It displays the overall fraud detection confidence and breaks it down by detection method.

## 🎯 Key Features

### 1. **Circular Progress Indicator**
- Shows overall confidence score (0-100%)
- Color-coded based on risk level:
  - 🟢 **Green (0-40%)**: Low confidence / Low risk
  - 🟡 **Yellow (40-60%)**: Medium confidence / Medium risk
  - 🟠 **Orange (60-80%)**: High confidence / High risk
  - 🔴 **Red (80-100%)**: Very high confidence / Critical risk

### 2. **Detection Methods Breakdown**
Each detection method shows:
- **Name & Description**: What it detects
- **Status Badge**: Active, Inactive, or Coming Soon
- **Weight**: How much it contributes to overall score
- **Confidence Score**: Method-specific confidence (0-100%)
- **Detection Stats**: Matches found / Accounts checked
- **Details Button**: Opens detailed explanation

### 3. **Weighted Confidence Calculation**
```typescript
Overall Confidence = Σ(Method Confidence × Method Weight) / Total Active Weight
```

## 🔍 Current Detection Methods

### **1. Device Fingerprinting (35% weight)** ✅ Active
- **What it detects**: Multiple accounts from the same device
- **How it works**: Collects and analyzes 50+ unique device characteristics:

#### **Core Identification (7 fields)**
  - Fingerprint ID (unique hash from FingerprintJS)
  - Browser name & version
  - Operating System & version
  - Device Type (desktop/mobile/tablet)

#### **Screen & Display (4 fields)**
  - Screen Resolution
  - Color Depth (bits)
  - Timezone
  - Language preference

#### **Network (2 fields)**
  - IP Address
  - Complete User Agent string

#### **Graphics & Hardware (11 fields)**
  - GPU (WebGL renderer)
  - WebGL Vendor & Renderer
  - Canvas Fingerprint (unique visual hash)
  - CPU Cores
  - Device Memory (GB)
  - Max Touch Points
  - Hardware Concurrency
  - Screen Orientation
  - Pixel Ratio
  - Touch Support (yes/no)
  - Battery Status (charging, level %)

#### **Media Capabilities (3 fields)**
  - Supported Audio Formats (mp3, ogg, wav, aac)
  - Supported Video Formats (mp4, webm, ogg)
  - Media Devices count

#### **Browser Plugins (1+ fields)**
  - Installed Browser Plugins (list of names)

#### **Installed Fonts (1+ fields)**
  - Detected System Fonts (12+ common fonts checked)

#### **Storage Capabilities (4 fields)**
  - Local Storage support
  - Session Storage support
  - IndexedDB support
  - Cookies Enabled status

#### **Browser Features (6 fields)**
  - WebGL 2.0 support
  - WebRTC support
  - Geolocation API support
  - Notifications API support
  - Service Worker support
  - WebAssembly support

#### **Detection Quality (1 field)**
  - FingerprintJS Confidence Score (0-100%)

#### **Usage Statistics (3 fields)**
  - Times Used (login count)
  - First Seen timestamp
  - Last Seen timestamp

**Total: 43 core fields + plugins array + fonts array = 50+ unique data points**

- **Confidence calculation**: Based on device similarity, hardware matching, and pattern analysis
- **Details View**: Shows ALL 50+ characteristics in organized categories for each account

### **2. IP Address Tracking (25% weight)** ✅ Active
- **What it detects**: Same IP + same browser combinations
- **How it works**: 
  - Tracks IP addresses
  - Combines with browser fingerprints
  - Detects VPN/Proxy/Tor usage
- **Confidence calculation**: 
  - Same IP + Same Browser = 90%
  - Same IP only = 70%

### **3. Mirror Trade Detection (20% weight)** 🔜 Coming Soon
- **What it detects**: Identical trading patterns across accounts
- **How it works**:
  - Analyzes trade entry/exit points
  - Compares position sizes
  - Checks timing correlation
  - Detects hedging strategies
- **Status**: Planned for future implementation

### **4. Payment Method Tracking (15% weight)** 🔜 Coming Soon
- **What it detects**: Same payment methods across accounts
- **How it works**:
  - Tracks card BIN numbers
  - Monitors billing addresses
  - Uses Stripe Radar fingerprints
  - Detects payment device IDs
- **Status**: Planned for future implementation

### **5. Behavioral Analysis (5% weight)** 🔜 Coming Soon
- **What it detects**: Same person operating multiple accounts
- **How it works**:
  - Mouse movement patterns
  - Typing speed and rhythm
  - Navigation patterns
  - Time-of-day activity
  - Behavioral biometrics
- **Status**: Planned for future implementation

## 🔧 How to Add New Detection Methods

### Step 1: Add to Detection Methods Array
Edit `components/admin/FraudConfidenceBreakdown.tsx`:

```typescript
const detectionMethods: DetectionMethod[] = [
  // ... existing methods ...
  {
    id: 'your_new_method',
    name: 'Your Method Name',
    description: 'Short description',
    icon: <YourIcon className="h-5 w-5" />,
    confidence: calculateYourMethodConfidence(evidence),
    status: 'active', // or 'coming_soon' or 'inactive'
    weight: 10, // How much it contributes (%)
    detailsText: 'Detailed explanation of how it works...',
    detectedCount: 0,
    totalChecked: 0
  }
];
```

### Step 2: Create Confidence Calculation Function
```typescript
function calculateYourMethodConfidence(evidence: any[]): number {
  if (!evidence || evidence.length === 0) return 0;
  
  // Look for your evidence type
  const yourEvidence = evidence.find(e => 
    e.type === 'your_evidence_type'
  );
  
  if (!yourEvidence) return 0;
  
  // Calculate confidence based on your logic
  // Return value between 0-100
  
  return calculatedConfidence;
}
```

### Step 3: Update Fraud Detection Logic
In your fraud detection service (e.g., `app/api/fraud/track-device/route.ts`):

```typescript
// When creating a fraud alert, include your evidence
const evidence = [
  // ... existing evidence ...
  {
    type: 'your_evidence_type',
    description: 'Description of what was found',
    data: {
      // Your specific data
      matchedAccounts: 2,
      totalChecked: 5,
      // ... other relevant data
    }
  }
];
```

### Step 4: Adjust Weights (if needed)
Ensure all weights sum to 100%:
```
Device Fingerprinting: 35%
IP Tracking: 25%
Mirror Trades: 20%
Payment Tracking: 15%
Behavioral Analysis: 5%
Your New Method: X%
-------------------
TOTAL: 100%
```

## 📍 Where It's Used

### **Per-Investigation Confidence Analysis**
- Each investigation alert has a "Confidence" button
- Opens **full-screen dialog** (90% viewport) with detailed breakdown
- Shows confidence **specific to that exact investigation**
- Calculates scores based on **only that alert's evidence**
- Displays all suspicious accounts involved in that case

### **Detailed Data View**
When clicking "Details" for any detection method:
- **Device Fingerprinting**: Shows ALL 50+ characteristics for each account:
  - Complete browser and OS information
  - Screen resolution and display settings
  - Network details (IP, User Agent)
  - Hardware fingerprints (GPU, Canvas, WebGL)
  - Usage statistics (times used, first/last seen)
  - Organized by account and device for easy comparison
- **IP Tracking**: Shows IP address groupings:
  - All accounts using each IP
  - Browser combinations per IP
  - Usage frequency and timestamps
  - Organized by IP address for pattern detection

### **Key Benefits:**
✅ **Individual Analysis**: Each investigation gets its own confidence assessment  
✅ **Specific Evidence**: Only uses evidence from that particular alert  
✅ **Accurate Scoring**: No mixing of data from different investigations  
✅ **Clear Context**: Shows which accounts and methods are involved  
✅ **Complete Transparency**: View all raw fingerprint data used for detection  
✅ **Easy Comparison**: Side-by-side device characteristics for pattern matching

## 🎨 Styling & Theme

The component uses your app's existing theme:
- **Colors**: Matches gray-scale with accent colors
- **Gradients**: Risk-based color gradients (green → yellow → orange → red)
- **Cards**: Consistent with admin panel design
- **Icons**: Lucide React icons

## 📈 Future Enhancements

### Mirror Trade Detection
1. Implement trade pattern comparison algorithm
2. Add correlation scoring
3. Integrate with trading history API
4. Update evidence structure

### Payment Tracking
1. Integrate Stripe Radar webhooks
2. Store payment fingerprints
3. Add payment method comparison
4. Implement cross-reference checks

### Behavioral Analysis
1. Add mouse tracking script
2. Implement typing pattern analysis
3. Create behavioral fingerprint database
4. Add machine learning model

## 🔐 Security Considerations

1. **Evidence Storage**: All evidence is stored securely in MongoDB
2. **Admin Only**: Confidence breakdown only visible to admins
3. **Privacy**: Sensitive data (full IPs, card details) are hashed/masked
4. **Audit Trail**: All admin actions on fraud alerts are logged

## 📊 Metrics & Analytics

Track these KPIs:
- **Overall Detection Accuracy**: % of true positives
- **False Positive Rate**: % of false alerts
- **Method Performance**: Individual method accuracy
- **Time to Resolution**: Average investigation duration
- **Action Distribution**: Ban/Suspend/Dismiss ratios

## 🧪 Testing

To test the system:
1. **Create fraud scenario**: Make test accounts from same device
2. **Log in multiple times**: Use different browsers with same IP
3. **Trigger detection**: System should create fraud alert
4. **Elevate to investigation**: Move alert to Investigation Center
5. **Click "Confidence" button**: Opens full-screen breakdown
6. **Verify specifics**:
   - Confidence scores show for that investigation only
   - Device fingerprinting shows detected accounts
   - IP tracking shows same IP + browser matches
   - Overall confidence is calculated correctly
   - Account list shows the specific suspicious accounts
7. **Test detailed data view**:
   - Click "Details" on Device Fingerprinting method
   - Should show **ALL 50+ characteristics** for each account
   - Verify data is organized by account and device
   - Check all categories: Core ID, Screen, Network, Graphics, Usage
   - Click "Details" on IP Tracking method
   - Should show IP groupings with browser combinations
8. **Check console logs**: Should show evidence structure and calculations
   ```
   🔍 [CONFIDENCE] Alert ID: 69281a60...
   🔍 [CONFIDENCE] Suspicious User IDs: ['6920351e...', '69203356...']
   🔍 [CONFIDENCE] Evidence: [{type: 'device_fingerprint', data: {...}}]
   ```

## 📝 Notes

- Weights can be adjusted based on real-world performance
- New methods automatically integrate when status = 'active'
- Coming soon methods show in UI but don't affect score
- System is designed to be transparent for admins
- All calculations happen in real-time

## 🎯 Success Metrics

A well-tuned system should have:
- **Overall Confidence > 70%** for true fraud cases
- **Overall Confidence < 40%** for false positives
- **Multiple methods agreeing** (2+ methods with high confidence)
- **Low false positive rate** (< 5%)

---

**Last Updated**: November 29, 2025
**Version**: 1.0.0
**Status**: Active (2 methods), 3 methods planned

