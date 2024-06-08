import similarWeb from './tests/SimilarWeb.js';
import Facebook from './tests/Facebook.js';

export default async function twofactorauth(req, env) {
	const { pr, repo } = req.params;
	const repository = `${env.OWNER}/${repo}`;

	// Fetch all entries modified in the PR
	const entries = await fetchEntries(repository, pr);

	for (const entry of entries) {
		try {
			// Validate primary domain
			await similarWeb(entry.domain, env);

			// Validate any additional domains
			for (const domain of entry['additional-domains'] || []) {
				await similarWeb(domain, env);
			}

			// Validate Facebook contact if present
			if (entry.contact?.facebook)
				await Facebook(entry.contact.facebook);

		} catch (e) {
			// Return an error response if validation fails
			return new Response(`::error:: ${e.message}`, { status: 400 });
		}
	}
	// Return a success response if no errors were thrown
	return new Response('OK');
}

/**
 * Fetch modified files in /entries/**
 *
 * @param repo Repository (owner/repo)
 * @param pr Pull Request number
 * @returns {Promise<*[]>} Returns all modified entry files as an array.
 */
async function fetchEntries(repo, pr) {
	const data = await fetch(
		`https://api.github.com/repos/${repo}/pulls/${pr}/files`, {
			headers: {
				'Accept': 'application/vnd.github.v3+json',
				'User-Agent': '2factorauth/twofactorauth (+https://2fa.directory/bots)'
			}
		});

	if (!data.ok) throw new Error(await data.text());

	const json = await data.json();
	let files = [];
	for (const i in json) {
		const file = json[i];

		// Ignore deleted files
		if (file.status === 'removed') continue;

		const path = file.filename;
		if (path.startsWith('entries/')) {
			// Parse entry file as JSON
			const f = await (await fetch(file.raw_url)).json();

			// Push first object of entry file to files array
			files.push(f[Object.keys(f)[0]]);
		}
	}

	return files;
}