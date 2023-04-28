const puppeteer = require("puppeteer-core");
const constants = require("./constants.json");
const CSVManager = require("./CSVManager");

(async () => {
    const browser = await puppeteer.launch({ headless: constants.config.useHeadlessMode, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", /*args: ["--blink-settings=imagesEnabled=false"]*/ }); //launch the puppeteer window
    const page = await browser.newPage(); //open a new page in the puppeteer browser
    await page.setViewport({ width: 1500, height: 800 }); //set a static frame size so that the layout doesn't change with different devices and afffect the web scraping
    page.on('console', consoleObj => consoleObj.text().substring(0,5) == "Found" ? console.log(consoleObj.text()) : null); //otherwise console.log won't work in page.evaulate because it runs it on the client side
    console.log("Browser started");

    const enteredZipCode = await enterZipCode(page)

    //block any images from loading, saves bandwidth & cpu
    await page.setRequestInterception(true)
    page.on('request', (req) => {
        //console.log(req.resourceType())
        if (req.resourceType() === 'image' || req.resourceType() === "stylesheet" || req.resourceType === "script" || req.resourceType() === "fetch") {
            req.abort()
        } else {
            req.continue()
        }
    })

    var productArray = []

    for (let i = 0; i < constants.categoryLinks.length; i++) {
        let link = constants.config.baseURL + constants.categoryLinks[i];
        let previousPageFirstItemName = ""

        for (let pageCounter = 1; ; pageCounter++) {
            try {
                await page.goto(`${link}&page=${pageCounter}`);

                try {
                    await page.waitForSelector(constants.selectors.item, {timeout:2000}); //wait for the page to render before continuing
                } catch { 
                    break //Exit the loop if there aren't any more pages in this category
                }

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
                        const outOfStock = item.querySelector(constants.selectors.outOfStock) && true;
        
                            if (!outOfStock && percentOff >= constants.config.minimumDiscount) { //select items that meet the minimum discount paramete
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

                if (previousPageFirstItemName === data.firstItemName) {
                    console.log("repeated page")
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
    await page.goto("https://amazon.com/fresh"); //navigate to any page.
    await page.click(constants.selectors.openZipCodeBox); //open the zipcode box

    await page.waitForSelector(constants.selectors.zipCodeInput, {
        visible: true,
    }); //wait for the input field to render 

    await page.waitForTimeout(500) //probably shouldn't be needed but it

    await page.focus(constants.selectors.zipCodeInput)
    await page.keyboard.type(constants.config.zipCode)
    await page.waitForTimeout(1000) //probably shouldn't be needed but it

    await page.click(constants.selectors.applyZipCodeButton)
    await page.waitForTimeout(500) //hack lol

    return true
}
