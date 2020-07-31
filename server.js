const express = require('express'),
	mongoose = require('mongoose'),
	Entry = require('./models'),
	request = require('@aero/centra'),
	{ differenceInYears } = require('date-fns')

const app = express(),
	config = require('dotenv').config()

if (config.error) {
	console.warn('[ERROR]: cannot parse .env file')
	process.exit(-1)
}

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/gh-visitors', { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })

const githubHeaders = {
	Authorization: `Basic ${Buffer.from(`${process.env.GITHUB_ID}:${process.env.GITHUB_TOKEN}`, 'utf8').toString('base64')}`,
	'User-Agent': 'pufler-dev'
}

app.use(express.urlencoded({ extended: false }))

app.get('/visits/:user/:repo', async (req, res) => {
	const { user, repo } = req.params
	const { counter } = await Entry.findOneAndUpdate({ key: `${user}/${repo}` }, { $inc: { counter: 1 } }, { upsert: true, new: true }).exec()
	res.contentType('image/svg+xml')
		.header('Cache-Control', 'no-cache,max-age=600')
		.send(await request(`https://img.shields.io/badge/Visits-${counter}-brightgreen${req.originalUrl.slice(req.originalUrl.indexOf('?'))}`).raw())
})

app.get('/years/:user', async (req, res) => {
	const { user } = req.params
	const { created_at: creation } = await request(`https://api.github.com/users/${user}`)
		.header(githubHeaders).json();
	const yearsAtGitHub = differenceInYears(Date.now(), Date.parse(creation));
	res.contentType('image/svg+xml')
		.header('Cache-Control', 'no-cache,max-age=600')
		.send(await request(`https://img.shields.io/badge/Years-${yearsAtGitHub}-brightgreen${req.originalUrl.slice(req.originalUrl.indexOf('?'))}`).raw())
})

app.get('/repos/:user', async (req, res) => {
	const { user } = req.params
	const { public_repos: repos } = await request(`https://api.github.com/users/${user}`)
		.header(githubHeaders).json();
	res.contentType('image/svg+xml')
		.header('Cache-Control', 'no-cache,max-age=600')
		.send(await request(`https://img.shields.io/badge/Repos-${repos}-brightgreen${req.originalUrl.slice(req.originalUrl.indexOf('?'))}`).raw())
})

app.use((_, res) => res.redirect('https://pufler.dev/git-badges/'))

app.use((err, _, res) => res.status(err.status || 5e2).send({ error: err.message }))

app.listen(process.env.PORT, () => console.log(`[INFO]: listening on port ${process.env.PORT}`))
