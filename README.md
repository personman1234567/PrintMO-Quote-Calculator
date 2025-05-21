# Print-MO Quote Calculator

A cross-platform desktop app that instantly builds customer quotes and estimates profits by combining blank apparel costs, optimized print-sheet layout, and your markup—presented in a clean, copy-and-paste format.

---

## Features

- **Blank & Print Costing**  
  • Fetches real-time blank prices (including active sales) from S&S Activewear API  
  • Packs artwork onto a 22.6″-wide gang sheet with 0.2″ margins, pricing at \$6.59 + \$0.55 per extra inch  

- **Quote Generation & Profit**  
  • Uses your CSV-driven unit costs + print options to compute unit & line totals  
  • Displays S&S blank cost, prints cost, and “Estimated Profit” side by side  
  • Formats a ready-to-send quote summary for quick email copy  

- **Dynamic UI**  
  • Dropdowns for apparel type, style, color, size & quantity  
  • Live-update order table with inline quantity editing & remove buttons  
  • One-click “Generate Quote” + clipboard copy  

---

## Screenshots

**Main Calculator**  
![image](https://github.com/user-attachments/assets/9bc675c2-fb3b-4a1d-a306-528d49520955)

**Order Table Visualization**  
![image](https://github.com/user-attachments/assets/c656d847-b6e8-44db-af0a-0b1fb79b4da4)

**Formatted Quote Output**  
![image](https://github.com/user-attachments/assets/dfce6ada-c2a9-4c9a-9059-b3c9fededeab)

---

## Configuration

Create a file named `.env` in the project root with your S&S credentials:

```env
SS_USER=YOUR_ACCOUNT_NUMBER
SS_PASSWORD=YOUR_API_KEY
