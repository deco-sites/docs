import { readdir, writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/ /g, '-')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
}

const sortDir = (a, b) => {
    const aPrefix = (a.name ?? a).slice(0, 2)
    const bPrefix = (b.name ?? b).slice(0, 2)
    const aIsNumber = !isNaN(aPrefix)
    const bIsNumber = !isNaN(bPrefix)

    if (aIsNumber && bIsNumber) {
        return Number(aPrefix) - Number(bPrefix)
    } else if (aIsNumber) {
        return -1
    } else if (bIsNumber) {
        return 1
    } else {
        return a.name.localeCompare(b.name)
    }
};

const translations = JSON.parse(await readFile('translations.json', 'utf8'));

async function gen(folder, lang) {
    // Sort by 00_, 01_, 02_, etc.
    const files = (await readdir(folder, { withFileTypes: true })).sort(sortDir)
    const groupBase = (lang === "Português") ? translations[folder] : undefined;
    const navigation = {
        // Get filename without 00_
        group: (groupBase ?? folder).replaceAll('\\', '/')
            .split('/').pop()
            .replace(/\d+_/g, '')
            .replace(/-/g, " ")
            .replace(/_/g, " ")
            .replaceAll("api", "API")
            .replaceAll("cms", "CMS")
            .replaceAll("sdk", "SDK")
            .replace(/(^\w|\s\w(?!\w))/g, char => char.toUpperCase()),
        pages: [],
        version: lang,
    }

    for (const file of files) {
        const path = join(file.parentPath, file.name)
        // Get filename without 00_, remove initial docs/
        const finalPath = path
            .replaceAll('\\', '/')
            .replace(/\d+_/g, '')
            .replaceAll(/_/g, '-')
            .replace(/^docs\//, '');
        const slug = slugify(finalPath)

        if (file.isDirectory()) {
            navigation.pages.push(await gen(path.replace('.mdx', ''), lang));
        } else {
            // Create slugged file in `{lang}` folder
            await mkdir(dirname(slug), { recursive: true })
            await writeFile(slug, await readFile(path, 'utf8'))

            navigation.pages.push(slug.replace('.mdx', ''))
        }
    }

    return navigation
}

if (existsSync('pt')) await rm('pt', { recursive: true, force: true })
if (existsSync('en')) await rm('en', { recursive: true, force: true })

const navigationPT = await Promise.all((await readdir('docs/pt')).sort(sortDir).map(path => gen(`docs/pt/${path}`, 'Português')))
const navigationEN = await Promise.all((await readdir('docs/en')).sort(sortDir).map(path => gen(`docs/en/${path}`, 'English')))

const mintJson = JSON.parse(await readFile('mint.json', 'utf8'))
mintJson.navigation = [...navigationPT, ...navigationEN]

await writeFile('mint.json', JSON.stringify(mintJson, null, 4))
