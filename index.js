const Airtable = require('airtable-simple')
const axios = require('axios')
const cheerio = require('cheerio')
const sendgrid = require('@sendgrid/mail')
require('dotenv').config();

const run = async () => {
	const airtable = new Airtable(process.env['AIRTABLE_API_KEY'], process.env['AIRTABLE_BASE'], 'scrapers')
	sendgrid.setApiKey(process.env['SENDGRID_API_KEY'])

	const rows = await airtable.all()

	rows.forEach(async(row) => {
		const fields = row.fields

		if (!fields.url) {
		return
		}
		const response = await axios(fields.url)
		const $ = cheerio.load(response.data, {xmlMode: true})
		let ads = $(fields.ads_selector)
		let oldAds = JSON.parse(fields.viewed_ads)
		newAds = [];
		ads.each(async(i, ad) => {
			const link = $(ad).find('[data-testid="listing-link"]').attr('href');
			const parts = link.split("/");
			let adId = parts[parts.length - 1];
			adId = adId.replace(/\D/g,'');
			if (oldAds.includes(adId)) {
				return;
			}
			newAds.push(adId);

			const title = $(ad).find(fields.title_selector).text().trim();

			if (fields.exclude !== undefined && title.toLowerCase().includes(fields.exclude)) {
				return;
			}

			let baseUrl = typeof fields.base_url !== 'undefined' ? fields.base_url : ''

			let myAd = {
				title: title,
				price: $(ad).find(fields.price_selector).text().trim(),
				location: $(ad).find(fields.location_selector).text().trim(),
				image: $(ad).find('noscript img').attr('src'),
				link: baseUrl + link
			}

			let msg = {
				to: fields.email,
				from: 'spencer.wallace@outlook.com',
				subject: fields.subject,
				html: `
				<h1>${myAd.title}</h1>
				<br>
				<a href="${myAd.link}">
				<img src="${myAd.image}">
				</a>
				<br>
				<div>${myAd.location}</div>
				<br>
				<div>${myAd.price}</div>
				<a href="${myAd.link}">
					<button>Go to Ad</button>
				</a>`
			}

			try {
				await sendgrid.send(msg)
			} catch (error) {
				console.log(error)
			}

		})

		if (row.fields.save_all) {
			allAds = [...new Set([...newAds,...oldAds])];
		}
		airtable.update(row.id, 'viewed_ads', JSON.stringify(allAds))
	});
}

run();