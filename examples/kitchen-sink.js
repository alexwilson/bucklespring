#!/usr/bin/env node

// Reference self as a module!
require('module-alias/register')

const unified = require('unified')
const frontMatter = require('remark-frontmatter')
const serializeMarkdown = require('remark-stringify')

const { notionToMdast } = require('bucklespring')
const { getNotionPage } = require('bucklespring/helper/notion-api')

const notionToMarkdown = async (pageId) => {
    const notionPage = JSON.stringify(await getNotionPage(pageId))
    const tree = await unified()
        .use(notionToMdast)
        .use(serializeMarkdown)
        .use(frontMatter)
        .process(notionPage)

    return tree
}

async function main() {
    // Kitchen Sink
    const tree = await notionToMarkdown("d08e52c1-1f05-4c27-85bc-e215261fa4dd")
    console.log(tree.toString())
}
main()