import { createAgent } from 'notionapi-agent'
import { Block } from 'notionapi-agent/dist/interfaces'
import type { PageChunk } from '../types'

type Options = {
    notionToken?: string
}
const getToken = (options: Options): string|undefined => {
    if (options.notionToken) {
        return options.notionToken
    }
    if (process && process.env && process.env.NOTION_TOKEN) {
        return process.env.NOTION_TOKEN
    }

    return undefined
}

export async function getNotionCollection(collectionId: string, collectionViewId: string, options: Options = {}): Promise<string[]> {

    const agent = createAgent({token: getToken(options)})
    const collection = await agent.queryCollection({
        collectionId,
        collectionViewId,

        //@ts-ignore
        query: { aggregations: [{ property: "title", aggregator: "count" }] },
        loader: {
            limit: 99999,
            loadContentCover: false,
            type: "table",
            userTimeZone: "UTC",
            userLocale: ""
        }
    })
    return collection.result.blockIds
}

export async function getNotionPage(pageId: string, options: Options = {}): Promise<PageChunk> {
    const agent = createAgent({token: getToken(options)})
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

    return page
}