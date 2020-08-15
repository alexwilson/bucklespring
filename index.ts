const os = require('os')
const unified = require('unified')
const frontMatter = require('remark-frontmatter')
const serializeMarkdown = require('remark-stringify')

import { createAgent } from 'notionapi-agent'
import { notionToMdast } from './src/notion-to-mdast'
import { getNotionPage, getNotionCollection } from './src/notion-api-helper'

const notionToMarkdown = async (pageId: string) => {

    const notionPage = JSON.stringify(await getNotionPage(pageId))

    const tree = unified()
        .use(notionToMdast)
        .use(serializeMarkdown)
        .use(frontMatter)
        .process(notionPage)
    
    console.log((await tree).toString(), os.EOL, os.EOL)
}

async function main() {

    // My blog!
    (await getNotionCollection("da1b3b30-d87c-4759-9e74-461fca190623", "3287d58d-72e4-4acf-8402-5241953ef9f1"))
    .map(await notionToMarkdown)

    // Kitchen Sink
    await notionToMarkdown("d08e52c1-1f05-4c27-85bc-e215261fa4dd")

    if (!process.env.NOTION_TOKEN) {
        throw new Error ("Missing the NOTION_TOKEN environment variable.")
    }

}
main()