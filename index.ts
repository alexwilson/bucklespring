const os = require('os')
const unified = require('unified')
const frontMatter = require('remark-frontmatter')
const serializeMarkdown = require('remark-stringify')

import { createAgent } from 'notionapi-agent'
import { notionToMdast } from './src/parser' 
import { Block } from 'notionapi-agent/dist/interfaces'

const notionCollection = async (collectionId: string, collectionViewId: string): Promise<string[]> => {
    const agent = createAgent({token: process.env.NOTION_TOKEN})
    const collection = await agent.queryCollection({
        collectionId,
        collectionViewId,

        //@ts-ignore
        query: { aggregations: [{ property: "title", aggregator: "count" }] },
        loader: {
            limit: 99999,
            loadContentCover: false,
            type: "table",
            userTimeZone: "",
            userLocale: ""
        }
    })
    return collection.result.blockIds
}

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

    // Expand InlienCollectionViews by appending them to the recordMap.
    const collectionViews = await Promise.all(
        Object.values(page.recordMap.block)
            .map(({ value }): Block => (value))
            .filter(block => (block.parent_id === pageId && block.type === 'collection_view'))
            .map((block: Block.CollectionViewInline) => {
                const collectionView = Object.values(page.recordMap.collection_view)
                    .map(({value}) => value)
                    .filter(collectionView => collectionView.type === 'table')
                    .filter(collectionView => block.view_ids.includes(collectionView.id))
                    .shift()

                const {type, query2} = collectionView
                return agent.queryCollection({
                    collectionId: block.collection_id,
                    collectionViewId: collectionView.id,
                    query: query2,
                    loader: {
                        limit: 99999,
                        loadContentCover: false,
                        type: 'table',
                        userTimeZone: "",
                        userLocale: ""
                    }
                })
            })
    ).then(res => res.map(record => record.recordMap.block))
    collectionViews.forEach(collectionBlock => {
        page.recordMap.block = Object.assign(page.recordMap.block, collectionBlock)
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

    // My blog!
    (await notionCollection("da1b3b30-d87c-4759-9e74-461fca190623", "3287d58d-72e4-4acf-8402-5241953ef9f1"))
    .map(await notionToMarkdown)

    // Kitchen Sink
    await notionToMarkdown("d08e52c1-1f05-4c27-85bc-e215261fa4dd")

    if (!process.env.NOTION_TOKEN) {
        throw new Error ("Missing the NOTION_TOKEN environment variable.")
    }

}
main()