# 📍 Where to Find & How to Use - Timeslot Availability Feature

## Location in Admin Dashboard

```
┌─────────────────────────────────────────────────────────┐
│                    APPOINTMENTS PAGE                     │
├─────────────────┬─────────────────────────────────────────┤
│                 │                                         │
│    CALENDAR     │        QUEUE / TIMESLOTS SECTION       │
│                 │                                         │
│  M T W T F S S  │  ┌─────────────────────────────────┐  │
│                 │  │  Slot Summary                   │  │
│  1 2 3 4 5 6 7  │  │  ┌─────┬─────┬────────────────┐  │  │
│  8 9 ...  ...   │  │  │Avail│Book │Pending         │  │  │
│                 │  │  │  3  │  5  │  2             │  │  │
│   [SELECT DATE] │  │  └─────┴─────┴────────────────┘  │  │
│                 │  │  Max 10 slots per day             │  │
│                 │  │                                   │  │
│                 │  ├─────────────────────────────────┤  │
│                 │  │ 🆕 TIMESLOT AVAILABILITY       │  │
│                 │  ├─────────────────────────────────┤  │
│                 │  │ ┌───────┐ ┌───────┐ ┌──────────┐ │  │
│                 │  │ │8:20 AM│ │9:20 AM│ │10:20 AM  │ │  │
│                 │  │ │🟢 Avl │ │🟠 Book│ │🔴 Blocked│ │  │
│                 │  │ └───────┘ └───────┘ └──────────┘ │  │
│                 │  │ ┌───────┐ ┌───────┐ ┌──────────┐ │  │
│                 │  │ │11:20 AM│ │12:10 PM│ │1:20 PM  │ │  │
│                 │  │ │🟢 Avl │ │🟢 Avl │ │🟢 Avl    │ │  │
│                 │  │ └───────┘ └───────┘ └──────────┘ │  │
│                 │  │ ... (more timeslots)             │  │
│                 │  │                                   │  │
│                 │  │ Click available slots to         │  │
│                 │  │ block them from users.           │  │
│                 │  └─────────────────────────────────┘  │
│                 │                                         │
└─────────────────┴─────────────────────────────────────────┘
```

---

## Step-by-Step Guide

### Step 1: Open Appointments Page
```
1. Click "Appointments" in sidebar menu
2. Calendar appears on left, queue on right
```

### Step 2: Select a Date
```
1. Click any date in the calendar
2. Timeslots load for that day
3. Scroll down to see "Timeslot Availability" section
```

### Step 3: View Timeslots
```
You'll see a grid of buttons:

Green Buttons (🟢 Available)
├─ Clickable
├─ Can be blocked
└─ Shows "Available" status

Orange Buttons (🟠 Booked)
├─ Not clickable
├─ Has existing appointments
└─ Cannot be toggled

Red Buttons (🔴 Blocked)
├─ Clickable
├─ Was previously blocked
└─ Shows "Blocked" status
```

### Step 4: Block a Timeslot
```
To prevent users from booking a slot:

1. Find a green (Available) button
2. Click it
3. Button turns red (Blocked)
4. Toast shows: "Timeslot marked as unavailable"
5. ✅ Slot is now blocked for users
```

### Step 5: Unblock a Timeslot
```
To make a blocked slot available again:

1. Find a red (Blocked) button
2. Click it
3. Button turns green (Available)
4. Toast shows: "Timeslot marked as available"
5. ✅ Slot is now available for users
```

---

## Visual Guide: Button States

### 🟢 Available (Green)
```
┌──────────┐
│8:20 AM   │
│Available │
└──────────┘
├─ Status: Can be booked by users
├─ Appearance: Bright green, visible
├─ Cursor: Pointer (clickable)
└─ Action: Click to block
```

### 🟠 Booked (Orange)
```
┌──────────┐
│9:20 AM   │
│Booked    │
└──────────┘
├─ Status: Has existing appointments
├─ Appearance: Orange, faded
├─ Cursor: Not-allowed (disabled)
└─ Action: Cannot be toggled
   Tooltip: "Cannot toggle - slot is booked"
```

### 🔴 Blocked (Red)
```
┌──────────┐
│10:20 AM  │
│Blocked   │
└──────────┘
├─ Status: Unavailable to users
├─ Appearance: Bright red, visible
├─ Cursor: Pointer (clickable)
└─ Action: Click to unblock
```

---

## Common Scenarios

### Scenario 1: Fully Booked Timeslot
```
User calls: "Are there any slots available at 2:20 PM?"
Admin sees: All 10 slots for the day are booked
Action: Block all remaining available slots to prevent more bookings
Result: Orange buttons show booked slots (cannot toggle)
        Green buttons are blocked (turned red)
```

### Scenario 2: Maintenance or Closed Hours
```
Service time: Admin needs to reserve time for maintenance
Admin blocks: Multiple timeslots (e.g., 3:50 PM, 4:50 PM, 5:50 PM)
Result: Users cannot see or book those slots in mobile app
```

### Scenario 3: Undo Blocking
```
Admin blocks: 2:20 PM slot by mistake
Admin clicks: Red 2:20 PM button to unblock
Result: Button turns green, slot is now available again
```

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move between buttons |
| Enter | Click/toggle button |
| Space | Click/toggle button |
| Esc | Close any tooltips |

---

## Mobile Responsive Behavior

### Desktop (1200px+)
```
┌─┬─┬─┬─┐
│ │ │ │ │  4 buttons per row
└─┴─┴─┴─┘
```

### Tablet (768px - 1199px)
```
┌─┬─┬─┐
│ │ │ │  3 buttons per row
└─┴─┴─┘
```

### Mobile (Under 768px)
```
┌─┬─┐
│ │ │  2 buttons per row
└─┴─┘
```

---

## Success Indicators

### Visual Feedback
✅ Button changes color immediately
✅ Toast notification appears
✅ Changes persist after refresh
✅ Color change smooth with animation

### Confirmation
✅ Green → Red (successfully blocked)
✅ Red → Green (successfully unblocked)
✅ Toast: "Timeslot marked as unavailable/available"

---

## Troubleshooting

### Buttons Not Responding
**Problem**: Click on button but nothing happens
**Solution**:
1. Ensure it's a green or red button (orange cannot be toggled)
2. Check browser console for errors
3. Refresh page and try again
4. Verify Firebase is connected

### Cannot See Timeslot Section
**Problem**: "Timeslot Availability" section not visible
**Solution**:
1. Scroll down in right sidebar
2. Select a date in calendar
3. Ensure you're on Appointments page
4. Try different browser if issue persists

### Changes Not Saving
**Problem**: Block a slot but it reverts back
**Solution**:
1. Check internet connection
2. Verify Firestore permissions
3. Check browser console for errors
4. Try blocking a different date/time

---

## Best Practices

### ✅ DO
- ✓ Block slots that are fully booked
- ✓ Check Orange slots before trying to block
- ✓ Unblock slots if you blocked by mistake
- ✓ Communicate with team about blocks

### ❌ DON'T
- ✗ Try to block Orange (booked) slots - they're already protected
- ✗ Leave slots blocked permanently if service becomes available
- ✗ Block entire days at once (better to block specific slots)
- ✗ Ignore Orange slots when planning capacity

---

## FAQ

**Q: Will users see blocked slots in the mobile app?**
A: No, blocked slots will be hidden and unavailable for booking once the mobile app is updated to check this data.

**Q: Can I block a slot that already has appointments?**
A: No, Orange buttons are disabled to protect existing appointments. Cancel appointments first if needed.

**Q: Do I need to manually unblock slots?**
A: Yes, blocks are permanent until you manually unblock them. Consider your business needs.

**Q: Will other admins see my blocks?**
A: Yes, blocks are stored in Firestore and visible to all admins in real-time.

**Q: Can I bulk block multiple slots at once?**
A: Currently no, but this can be added as a future enhancement.

**Q: What happens if I refresh the page?**
A: Blocks remain saved in Firestore and reappear when page reloads.

---

## Integration Flow

```
Admin Actions:
  1. Select date
  2. View timeslots
  3. Click button to block/unblock
  ↓
  Saved to Firestore:
    settings/unavailableSlots collection
  ↓
  Mobile App:
    1. Fetch unavailableSlots
    2. Filter out blocked slots
    3. Display only available slots to users
  ↓
  User Experience:
    ✓ Cannot see blocked slots
    ✓ Cannot book blocked slots
    ✓ Only sees available options
```

---

## Summary

The **Timeslot Availability** feature gives you complete control over which time slots users can book. Use it to:
- ✅ Prevent overbooking
- ✅ Block maintenance windows
- ✅ Manage capacity
- ✅ Plan resource allocation

Simply click green or red buttons to manage timeslot availability!

---

**Version**: 1.0  
**Last Updated**: December 7, 2025  
**Status**: ✅ Ready to Use
