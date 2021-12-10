const fs = require('fs');
const path = require('path');
const os = require('os');

const exportData = (data) => {
    let sortedData = data.sort((a, b) => b.percentOff - a.percentOff)
    const output = ["Item name,Price,Regular price,Percent off,Link"]
    const filename = path.join(__dirname, 'output.csv');

    sortedData.forEach(item => {
        output.push(`"${item.name}",$${item.newPrice},$${item.slashedPrice},${item.percentOff}%,${item.link}`)
    });

    fs.writeFileSync(filename, output.join(os.EOL)); //will create the file if it doesn't already exist
    console.log("Wrote data to file")
}

module.exports = {exportData}