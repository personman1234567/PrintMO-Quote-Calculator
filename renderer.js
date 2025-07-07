const { ipcRenderer } = require('electron');
const fs   = require('fs');
const path = require('path');
const Papa = require('papaparse');

require('dotenv').config();
const { fetchBlankPrice, fetchVariants } = require('./ssApi');

let products = [];
let cart     = [];

const printOptions = [
  { label: 'Breast Print', price: 2.00 },
  { label: 'Chest Print',  price: 5.00 },
  { label: 'Full Print',   price: 8.00 },
  { label: 'Sleeve #1',    price: 4.00 },
  { label: 'Sleeve #2',    price: 4.00 },
  { label: 'Neck Tag',     price: 2.00 },
  { label: 'Back Tag',     price: 2.00 },
  { label: 'Half Back',    price: 5.00 },
  { label: 'Full Back',    price: 8.00 },
];

const printDims = {
  'Breast Print': { w: 5,  h: 5  },
  'Chest Print':  { w: 8,  h: 11 },
  'Full Print':   { w: 14, h: 11 },
  'Sleeve #1':    { w: 4,  h: 4  },
  'Sleeve #2':    { w: 4,  h: 4  },
  'Neck Tag':     { w: 2,  h: 2  },
  'Back Tag':     { w: 4,  h: 4  },
  'Half Back':    { w: 11, h: 8  },
  'Full Back':    { w: 11, h: 14 },
};

const discountTiers = [
  { min: 1,   max: 11,       pct: 0,    label: '0%' },
  { min: 12,  max: 24,       pct: 0.10, label: '5%' },
  { min: 25,  max: 48,       pct: 0.15, label: '10%' },
  { min: 49,  max: 72,       pct: 0.20, label: '15%' },
  { min: 73,  max: 96,       pct: 0.25, label: '20%' },
  { min: 100, max: Infinity, pct: 0,    label: 'Negotiable' },
];

function getDiscountTier(qty) {
  return discountTiers.find(t => qty >= t.min && qty <= t.max);
}

async function loadProducts() {
  const rawPath = path.join(__dirname, 'products.csv');
  const raw     = fs.readFileSync(rawPath, 'utf8');
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true });

  products = data.map(row => {
    const sizes = {};
    ['XXS','XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL','One Size']
      .forEach(sz => {
        sizes[sz] = row[sz] ? parseFloat(row[sz]) : null;
      });
    return {
      code: row.Code,
      name: row['Product Name'],
      type: row['Apparel Type'],
      styleID: row.StyleID,
      sizes
    };
  });

  populateTypeSelect();
  updateProductOptions();
  await updateColorOptions();
}

function renderOrderTable() {
  const tbody = document.querySelector('#orderTable tbody');
  tbody.innerHTML = '';

  cart.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${item.code} – ${item.name}</td>
      <td>${item.size}</td>
      <td>
        <input
          type="number"
          class="qty-input"
          min="1"
          data-index="${idx}"
          value="${item.qty}"
        />
      </td>
      <td>${item.prints.join(', ')}</td>
      <td>$${item.unitPrice.toFixed(2)}</td>
      <td>$${item.lineTotal.toFixed(2)}</td>
      <td>
        <button class="del-btn" data-index="${idx}">&times;</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // wire up the “×” buttons
  document.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = Number(e.currentTarget.dataset.index);
      cart.splice(i, 1);
      renderOrderTable();
      document.getElementById('quoteBox').value = '';
    });
  });

  // wire up the editable quantity inputs
  document.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('change', e => {
      const i = Number(e.target.dataset.index);
      let newQty = parseInt(e.target.value, 10);
      if (isNaN(newQty) || newQty < 1) newQty = 1;
      cart[i].qty       = newQty;
      cart[i].lineTotal = cart[i].unitPrice * newQty;
      renderOrderTable();
      document.getElementById('quoteBox').value = '';
    });
  });

  // and finally update the S&S‐cost, prints‐cost and profit panels
  updateSSCostPanel();
  document.getElementById('printsCostValue').textContent = `$${calcPrintCost().toFixed(2)}`;
  updateProfitPanel();
}

function populateTypeSelect() {
  const types = [...new Set(products.map(p => p.type))];
  const sel   = document.getElementById('typeSelect');
  sel.innerHTML = '';
  types.forEach(t => {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = t;
    sel.appendChild(o);
  });
}

function updateProductOptions() {
  const chosenType = document.getElementById('typeSelect').value;
  const prodSel    = document.getElementById('productSelect');
  prodSel.innerHTML = '';

  products.forEach((p,i) => {
    if (p.type === chosenType) {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = `${p.code} – ${p.name}`;
      prodSel.appendChild(o);
    }
  });
  document.getElementById('prodSearch').value = '';
  updateSizeOptions();
}

function updateSizeOptions() {
  const prod = products[+document.getElementById('productSelect').value];
  const szSel = document.getElementById('sizeSelect');
  szSel.innerHTML = '';
  Object.entries(prod.sizes).forEach(([sz, price]) => {
    if (price != null) {
      const o = document.createElement('option');
      o.value = sz;
      o.textContent = `${sz} ($${price.toFixed(2)})`;
      szSel.appendChild(o);
    }
  });
}

function updateProfitPanel() {
  const subtotal  = cart.reduce((sum, item) =>
    sum + item.unitPrice * item.qty, 0);
  const totalQty  = cart.reduce((sum, item) => sum + item.qty, 0);
  const tier      = getDiscountTier(totalQty);
  const customerTotal = subtotal * (1 - tier.pct);
  
  const ssTotal = cart.reduce((sum, item) =>
    sum + item.ssPrice * item.qty, 0);
  const printsTotal = calcPrintCost();
  const profit = customerTotal - ssTotal - printsTotal;
  document.getElementById('profitValue').textContent =
    `$${profit.toFixed(2)}`;
}

function calcPrintCost() {
  const sheetW   = 22.6;
  const maxLen   = 239.26;
  const margin   = 0.2;
  const baseLen  = 12;
  const baseCost = 6.59;
  const perInch  = 0.55;

  const allPrints = [];
  cart.forEach(item => {
    item.prints.forEach(label => {
      const dim = printDims[label];
      for (let i = 0; i < item.qty; i++) {
        let w = dim.w, h = dim.h;
        if (h < w && h <= sheetW) [w, h] = [h, w];
        allPrints.push({ w, h });
      }
    });
  });

  allPrints.sort((a,b) => b.h - a.h);

  const sheets = [];
  function tryPlace(pr, sheet) {
    for (const shelf of sheet.shelves) {
      if (pr.w <= shelf.remW) {
        shelf.remW -= (pr.w + margin);
        return true;
      }
    }
    const addH = (sheet.shelves.length ? margin : 0) + pr.h;
    if (sheet.usedH + addH <= maxLen) {
      sheet.shelves.push({ remW: sheetW - pr.w - margin });
      sheet.usedH += addH;
      return true;
    }
    return false;
  }

  for (const pr of allPrints) {
    let placed = false;
    for (const sh of sheets) {
      if (tryPlace(pr, sh)) { placed = true; break; }
    }
    if (!placed) {
      sheets.push({
        shelves: [{ remW: sheetW - pr.w - margin }],
        usedH:   pr.h
      });
    }
  }

  let total = 0;
  for (const sh of sheets) {
    const billLen = Math.max(sh.usedH, baseLen);
    total += baseCost + perInch * (billLen - baseLen);
  }
  return total;
}

async function updateColorOptions() {
  const prodIdx = +document.getElementById('productSelect').value;
  const styleID = products[prodIdx].styleID;
  const colorSel = document.getElementById('colorSelect');

  colorSel.innerHTML = '<option>Loading colors…</option>';

  let variants;
  try {
    variants = await fetchVariants(styleID);
  } catch (err) {
    alert('Error fetching colors: ' + err.message);
    colorSel.innerHTML = '<option value="">(error)</option>';
    return;
  }

  const seen = new Set();
  const colors = [];
  for (const v of variants) {
    const key = v.colorCode + '|' + v.colorName;
    if (!seen.has(key)) {
      seen.add(key);
      colors.push({ code: v.colorCode, name: v.colorName });
    }
  }

  colorSel.innerHTML = '';
  colors.forEach(c => {
    const o = document.createElement('option');
    o.value       = c.code;
    o.textContent = c.name;
    colorSel.appendChild(o);
  });
}

function renderPrintOptions() {
  const container = document.getElementById('printOptions');
  container.innerHTML = '';
  printOptions.forEach((opt,i) => {
    const id = `printOpt${i}`;
    const lbl = document.createElement('label');
    lbl.innerHTML = `<input type="checkbox" id="${id}" data-price="${opt.price}"> ${opt.label}`;
    container.appendChild(lbl);
  });
}

function updateSSCostPanel() {
  const ssTotal = cart.reduce((sum, item) =>
    sum + (item.ssPrice * item.qty), 0);
  document.getElementById('ssCostValue').textContent =
    `$${ssTotal.toFixed(2)}`;
}

async function addEventListeners() {
  document.getElementById('typeSelect')
    .addEventListener('change', updateProductOptions);
  document.getElementById('prodSearch')
    .addEventListener('input', e => {
      const term = e.target.value.toLowerCase();
      const opts = document.getElementById('productSelect').options;
      for (let o of opts) {
        o.hidden = !o.textContent.toLowerCase().includes(term);
      }
      const sel = document.getElementById('productSelect');
      if (sel.selectedOptions[0]?.hidden) {
        for (let o of opts) {
          if (!o.hidden) { sel.value = o.value; break; }
        }
        updateSizeOptions();
      }
    });

  document.getElementById('productSelect')
    .addEventListener('change', async () => {
      updateSizeOptions();
      await updateColorOptions();
    });

  document.getElementById('addBtn')
    .addEventListener('click', async () => {
      const prod      = products[+productSelect.value];
      const size      = sizeSelect.value;
      const colorCode = colorSelect.value;
      const qty       = +qtyInput.value;

      const localBlankPrice = prod.sizes[size];
      let ssPrice = 0;
      try {
        ssPrice = await fetchBlankPrice(prod.styleID, size, colorCode);
      } catch (e) {
        console.warn('Couldn’t fetch S&S price:', e);
      }

      const chosenPrints = [];
      const printPrices  = {};
      printOptions.forEach((opt,i) => {
        const cb = document.getElementById(`printOpt${i}`);
        if (cb.checked) {
          chosenPrints.push(opt.label);
          printPrices[opt.label] = opt.price;
          cb.checked = false;
        }
      });
      const printsCost = chosenPrints.reduce((sum,p) =>
        sum + printPrices[p], 0);

      const unitPrice = localBlankPrice + printsCost;
      const lineTotal = unitPrice * qty;

      cart.push({
        code: prod.code,
        name: prod.name,
        size,
        colorCode,
        qty,
        prints: chosenPrints,
        printPrices,
        localBlankPrice,
        ssPrice,
        unitPrice,
        lineTotal
      });

      renderOrderTable();
      updateSSCostPanel();
      qtyInput.value = '1';
    });

  document.getElementById('createQuoteBtn')
    .addEventListener('click', () => {
      let text = '';
      let grandBefore = 0, totalQty = 0;

      cart.forEach((item,i) => {
        text += `${i+1}) ${item.qty} x ${item.name} (${item.size})\n`;
        if (item.prints.length) {
          const list = item.prints
            .map(p => `${p} ($${item.printPrices[p].toFixed(2)})`)
            .join(', ');
          text += `    Prints: ${list}\n`;
        }
        text += `    Price per blank shirt (your price): $${item.localBlankPrice.toFixed(2)}\n`;
        text += `    Price per unit (with prints): $${item.unitPrice.toFixed(2)}\n`;
        text += `    Line total: $${item.lineTotal.toFixed(2)}\n\n`;

        grandBefore += item.lineTotal;
        totalQty    += item.qty;
      });

      const tier  = getDiscountTier(totalQty);
      const after = grandBefore * (1 - tier.pct);

      text += `Total quantity: ${totalQty}\n`;
      text += `Grand total before discount: $${grandBefore.toFixed(2)}\n`;
      text += `Discount tier: ${tier.label}\n`;
      text += `Grand total after discount: $${after.toFixed(2)}\n`;

      document.getElementById('quoteBox').value = text;
    });

  document.getElementById('copyBtn')
    .addEventListener('click', () => {
      navigator.clipboard.writeText(
        document.getElementById('quoteBox').value
      );
    });

  document.getElementById('reloadBtn')
    .addEventListener('click', async () => {
      cart = [];
      await loadProducts();
      renderOrderTable();
      document.getElementById('quoteBox').value = '';
    });
}

window.addEventListener('DOMContentLoaded', async () => {
  // --- new: load or prompt for S&S credentials ---
  // const { user, pass } = await window.electronAPI.getSSCreds();
  // if (!user || !pass) {
  //   const u = prompt('Enter your S&S Account Number:');
  //   const p = prompt('Enter your S&S API Key:');
  //   await ipcRenderer.invoke('set-ss-creds', { user: u, pass: p });
  // }

  // --- existing initialization ---
  renderPrintOptions();
  await loadProducts();
  await addEventListeners();
});
