const os = require('os')
const unified = require('unified')
const frontMatter = require('remark-frontmatter')
const serializeMarkdown = require('remark-stringify')

import { createAgent } from 'notionapi-agent'
import { notionToMdast } from './src/parser' 

const notionToMarkdown = async (pageId: string) => {
    const agent = createAgent({token: process.env.NOTION_TOKEN})
    const page = await agent.loadPageChunk({
        pageId,
        limit: 99999,
        cursor: {
            stack: []
        },
        chunkNumber: 0,
        verticalColumns: false
    })
    const notionPage = JSON.stringify(page)

    const tree = unified()
        .use(notionToMdast)
        .use(serializeMarkdown)
        .use(frontMatter)
        .process(notionPage)
    
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