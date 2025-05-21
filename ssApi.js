const axios = require('axios');

const BASE  = 'https://api.ssactivewear.com/v2/products/';

function isSaleStillValid(saleExpiration) {
  const now = new Date();                      
  const exp = new Date(saleExpiration); 

  exp.setHours(23, 59, 59, 999);
  return now <= exp;
}

async function fetchBlankPrice(styleID, sizeName, colorCode) {
    // 1) hit the JSON endpoint, explicitly asking for colorCode too
    const url = `${BASE}?style=${styleID}` +
                `&mediatype=json` +
                `&fields=piecePrice,salePrice,saleExpiration,sizeName,colorCode`;
    console.log('Hitting S&S:', url);

    const resp = await axios.get(url, {
        auth:    { username: process.env.SS_USER, password: process.env.SS_PASSWORD },
        headers: { Accept: 'application/json' }
    });
    console.log('Got back:', resp.data);

  // find the SKU array & the right size+color
  const items = resp.data;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`No products returned for STYLEID ${styleID}`);
  }
  const match = items.find(item =>
    item.sizeName  === sizeName &&
    item.colorCode === colorCode
  );
  if (!match) {
    throw new Error(
      `No SKU for style ${styleID} size ${sizeName} color ${colorCode}`
    );
  }
  console.log('🧐 match object:', match);

  // pick salePrice if it exists & is still valid; otherwise piecePrice
  let price = match.piecePrice;
  if (
    typeof match.salePrice === 'number' &&
    match.saleExpiration &&
    isSaleStillValid(match.saleExpiration)
  ) {
    console.log(
      `🎉 SALE ACTIVE! using salePrice $${match.salePrice.toFixed(2)}` +
      ` (expires ${match.saleExpiration.slice(0,10)})`
    );
    price = match.salePrice;
  }

  console.log(
    `🕵️‍♂️ Final blank price → styleID=${styleID}, ` +
    `size=${sizeName}, color=${colorCode}: $${price.toFixed(2)}`
  );
  return price;
}

async function fetchVariants(styleID) {
  const url = `${BASE}?style=${styleID}&mediatype=json` +
              `&fields=sizeName,colorName,colorCode,piecePrice,salePrice,saleExpiration`;
  console.log('🌐 fetchVariants GET', url);
  const resp = await axios.get(url, {
    auth: {
      username: process.env.SS_USER,
      password: process.env.SS_PASSWORD
    },
    headers: { Accept: 'application/json' }
  });
  if (!Array.isArray(resp.data)) {
    throw new Error('Unexpected variants response');
  }
  return resp.data;
}

module.exports = { fetchBlankPrice, fetchVariants };

//Notes for future changes:
//* Fix when the cost fields are updated because currently removing a row from an order changes field to nan
//* Have the print check boxes dynamically change on the screen according to what apparel type is selected
//* Add the rest of our products to the csv
//* Clean up UI formatting (After all the functionality is done)
//* Fix problem where initial color field is set to Loading... Make it load on app startup instead of when the user selects a color