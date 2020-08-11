const os = require('os')
const fetch = require('node-fetch')
const unified = require('unified')
const uuid = require('uuid')
const frontMatter = require('remark-frontmatter')
const serializeMarkdown = require('remark-stringify')

const {notionParser} = require('./src/parser')

const pageById = async (pageId, token) => {
    const notionFetch = (resource, query) => fetch(`https://www.notion.so/api/v3/${resource}`, {
        method: "POST",
        body: JSON.stringify(query),
        headers: {
            "Content-Type": "application/json",
            "Cookie": `token_v2=${token}`
        }
    }).then(res => res.json())

    const page = await notionFetch('loadPageChunk', {
        pageId,
        limit: 99999,
        cursor: {
            stack: []
        },
        chunkNumber: 0,
        verticalColumns: false
    })

    return page
}

const notionToMarkdown = async pageId => {
    const notionTest = JSON.stringify(await pageById(
        pageId,
        process.env.NOTION_TOKEN
    ))
    const tree = unified()
        .use(notionParser)
        .use(serializeMarkdown)
        .use(frontMatter)
        .process(notionTest)
    
    console.log((await tree).toString(), os.EOL, os.EOL)
}

async function main() {
    [
        "b810babe-acd7-4946-ac4b-b6b47a251b55",
        "fa567663-fe4c-410c-a087-91caa062479b",
        "c5f65145-92fc-4010-99bc-4879ab985432"
    ].map(notionToMarkdown)

    if (!process.env.NOTION_TOKEN) {
        throw new Error ("Missing the NOTION_TOKEN environment variable.")
    }

}
main()