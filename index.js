const puppeteer = require("puppeteer");
const constants = require("./constants.json");
const CSVManager = require("./CSVManager");

(async () => {
    const browser = await puppeteer.launch({ headless: constants.config.useHeadlessMode, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--blink-settings=imagesEnabled=false"] }); //launch the puppeteer window
    const page = await browser.newPage(); //open a new page in the puppeteer browser
    await page.setViewport({ width: 1500, height: 800 }); //set a static frame size so that the layout doesn't change with different devices and afffect the web scraping
    page.on('console', consoleObj => consoleObj.text().substring(0,5) == "Found" ? console.log(consoleObj.text()) : null); //otherwise console.log won't work in page.evaulate because it runs it on the client side
    console.log("Browser started");

    await enterZipCode(page)

    var productArray = []

    for (let i = 0; i < constants.categoryLinks.length; i++) {
        let link = constants.config.baseURL + constants.categoryLinks[i];
        let previousPageFirstItemName = ""

        for (let pageCounter = 1; ; pageCounter++) {
            try {
                await page.goto(`${link}&page=${pageCounter}`);
                await page.waitForSelector(constants.selectors.item); //wait for the page to render before continuing

                let data = await page.evaluate((constants) => { //pass the constants variable so that we can access it inside the function
                    let items = document.querySelectorAll(constants.selectors.item);
                    let discountedProducts = []
                    let itemsArray = Array.from(items) //make an array from all the products found on the page
                    let firstItemName = itemsArray[0] ? itemsArray[0].querySelector(constants.selectors.name).innerText : "" //needed in case the page is full (24 items) but is the last page. When passed a page number greater than this, amazon will just return the last page again
        
                    itemsArray.map((item) => {
                        if (item.querySelector(constants.selectors.slashedPrice)) { 
                            let slashedPrice = item.querySelector(constants.selectors.slashedPrice).innerHTML.substring(1)
                            let newPrice = item.querySelector(constants.selectors.price).innerHTML.substring(1)
                            let percentOff = parseInt(100 - parseFloat(newPrice) / parseFloat(slashedPrice) * 100)
        
                            if (percentOff >= constants.config.minimumDiscount) { //select items that meet the minimum discount parameter
                                let link = constants.config.baseURL + item.querySelector(constants.selectors.link).getAttribute("href")
                                let name = item.querySelector(constants.selectors.name).innerText
                                discountedProducts.push({link, name, slashedPrice, newPrice, percentOff})
        
                                console.log(`Found product ${name.substring(0,24) + (name.length > 24 ? "..." : "")} --- $${newPrice} (${percentOff}% off, was $${slashedPrice})`)
                            }
                        }
                    })
        
                    return {
                        products: discountedProducts,
                        isFullPage: items.length === 24, //there are 24 items in a full page, so if there are less than that we know this is the last page
                        firstItemName
                    }
                }, constants)
        
                if (!data.isFullPage || (previousPageFirstItemName === data.firstItemName)) {
                    break //if this page is the last in the category, we need to exit the loop
                }
        
                productArray = productArray.concat(data.products)
                previousPageFirstItemName = data.firstItemName
            } catch(e) {
                console.log("Error when attempting to load the page", e)
                break //exit the loop if the page fails to load or there aren't any products
            }
        }
            
    }

    CSVManager.exportData(productArray);
    await browser.close()
})();

const enterZipCode = async (page) => {
    await page.goto("https://amazon.com/fresh"); //navigate to any page. this will prompt the browser for a zipcode
    await page.click(constants.selectors.openZipCodeBox); //open the zipcode box
    await page.waitForSelector(constants.selectors.zipCodeInput, {
        visible: true,
    }); //wait for the input field to render 

    await page.click(constants.selectors.zipCodeInput)
    await page.keyboard.type(constants.config.zipCode)
    await page.click(constants.selectors.applyZipCodeButton)
    await page.click(constants.selectors.closePopupButton); //We need to close the popup for the zipcode change to actually take effect

    console.log("Successfully entered zipcode");
}

/*const printResults = (arr) => {
    let temp = arr.sort((a, b) => b.percentOff - a.percentOff)
    console.log(temp)
}*/