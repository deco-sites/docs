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

async function gen(folder, lang) {
    // Sort by 00_, 01_, 02_, etc.
    const files = (await readdir(folder, { withFileTypes: true })).sort(
        (a, b) => Number(a.name.slice(0, -2)) - Number(b.name.slice(0, -2)),
    )
    const navigation = {
        // Get filename without 00_
        group: folder.replaceAll('\\', '/').split('/').pop().replace(/\d+_/g, ''),
        pages: [],
        version: lang,
    }

    for (const file of files) {
        const path = join(file.parentPath, file.name)
        // Get filename without 00_, remove initial docs/
        const finalPath = path
            .replaceAll('\\', '/')
            .replace(/\d+_/g, '')
            .replace(/^docs\//, '')
        const slug = slugify(finalPath)

        if (file.isDirectory()) {
            navigation.pages.push(await gen(path.replace('.mdx', ''), lang))
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

const navigationPT = await Promise.all((await readdir('docs/pt')).map(path => gen(`docs/pt/${path}`, 'Português')))
const navigationEN = await Promise.all((await readdir('docs/en')).map(path => gen(`docs/en/${path}`, 'English')))

const mintJson = JSON.parse(await readFile('mint.json', 'utf8'))
mintJson.navigation = [...navigationPT, ...navigationEN]

await writeFile('mint.json', JSON.stringify(mintJson, null, 4))
