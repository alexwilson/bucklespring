import {Plugin} from 'unified'
import {Root, Content, List, ListItem, InlineCode, Emphasis, Strong, Link, YAML, Image, Code, Heading, Paragraph} from 'mdast'
import type { Block, SemanticString, NotionUser } from 'notionapi-agent/dist/interfaces'
import type { BlockRecord } from 'notionapi-agent/dist/interfaces/notion-api/v3/Record'
import u from 'unist-builder'
import yaml from 'js-yaml'
import camelCase from 'camelcase'
import { zonedTimeToUtc } from 'date-fns-tz'
import camelcase from 'camelcase'
import isUrl from 'is-url'
import { validate as isUuid } from 'uuid'
import { PageChunk, RecordMap } from './types'
import { formatISO } from 'date-fns'

function notionToMdast() {
    this.Parser = parser

    function parser(doc: string): Root {
        const pageChunk = JSON.parse(doc) as PageChunk
        const { recordMap, recordMap: { block } } = pageChunk

        const blocks: Block[] = []
        
        // If this page is part of a database/collection, it has a Page record
        const pageBlock: {value: Block.Page}|undefined = Object.values(block).find(
                ({value: {alive, type}}: BlockRecord) => (alive === true && type === 'page')
        ) as {value: Block.Page}|undefined

        // Populate the blocks in this page.
        if (pageBlock) {
            // When this page is in a database, we reference the blocks belonging to the current page
            blocks.push(
                pageBlock.value,
                ...pageBlock.value.content.map((id: string) => block[id].value)
            )
        } else {
            // Otherwise we use every block
            blocks.push(
                ...Object.values(block).map(b => b.value)
            )
        }

        // Begin MDAST
        const tree: Root = u('root', [])

        // Push nodes into the root-node.
        let previousNode
        for (const currentBlock of blocks) {
            const newNode = parseBlock(currentBlock, previousNode, recordMap)

            // Allow nodes to interact with their predecessor sibling
            if (newNode !== previousNode) {
                tree.children.push(newNode)
                previousNode = newNode
            }
        }

        return tree
    }
}

function parseBlock(block: Block, previousNode: Content, recordMap: RecordMap): Content {
    const { type } = block

    switch (type) {

        case 'page': {
            const { collection, notion_user } = recordMap
            const { properties } = <Block.Page>block
            const parentId = block.parent_id

            const schema = (collection && parentId in collection) ? collection[parentId].value.schema : undefined

            const users: {[key: string]: NotionUser} = {}
            Object.keys(notion_user).forEach(key => {
                users[key] = notion_user[key].value
            })

            const metadata = parsePageBlock(properties, schema, users)

            // We assume the page object is YAML frontmatter
            return u('yaml', {
                value: yaml.safeDump(metadata, {
                    noRefs: true,
                    skipInvalid: true,
                })
            }) as YAML
        }

        case 'video': {
            return u('link', {
                url: block.format.display_source,
                children: [{
                    type: 'text',
                    value: block.format.display_source
                }]
                
            }) as Link
        }

        case 'image': {
            const {format} = block
            return u('image', {
                url: `https://www.notion.so/image/${encodeURIComponent(format.display_source)}`,
                title: "",
                alt: ""
            }) as Image
        }

        case 'code': {
            const codeBlock = <Block.Code>block
            return u('code', {
                lang: camelcase(codeBlock.properties.language.flat(Infinity).shift()),
                value: codeBlock.properties.title.flat(Infinity).join('\n')
            }) as Code
        }

        case 'header': {
            const headerBlock = <Block.Header>block
            return u('heading', {
                depth: 1,
                children: parseTextBlock(headerBlock.properties.title, false)
            }) as Heading
        }

        case 'sub_header': {
            const subHeaderBlock = <Block.SubHeader>block
            return u('heading', {
                depth: 2,
                children: parseTextBlock(subHeaderBlock.properties.title, false)
            }) as Heading
        }

        case 'sub_sub_header': {
            const subSubHeaderBlock = <Block.SubSubHeader>block
            return u('heading', {
                depth: 2,
                children: parseTextBlock(subSubHeaderBlock.properties.title, false)
            }) as Heading
        }
        

        case 'bulleted_list':
        case 'numbered_list':
            const listBlock = <Block.BulletedList|Block.NumberedList>block
            const text = parseTextBlock(listBlock.properties.title)
            const listItem = u('listItem', {
                children: [u('paragraph', text) as Paragraph]
            }) as ListItem

            if (previousNode.type === 'list') {
                previousNode.children.push(listItem)
                return previousNode
            }

            return u('list', {
                ordered: type === 'numbered_list',
                children: [listItem]
            }) as List

        default:
            console.warn('Could not parse block', type, "treating as text!")

        case 'text': {
            const textBlock = <Block.Text>block
            const text = ('properties' in textBlock && 'title' in textBlock.properties) ? parseTextBlock(textBlock.properties.title) : []
            return u('paragraph', text) as Paragraph
        }
    }
}

function parseTextBlock(textNode: SemanticString[], withDecorators: boolean = true) {
    return textNode.map(([text, decorators]): Content => {

        // Build a base text node
        let node: Content = u('text', {
            value: <string>text
        })

        // Apply decorators by nesting this item.
        if (decorators && withDecorators) {
            for (const decorator of decorators) {
                switch(decorator[0]) {

                    // Link block.
                    case 'a': {
                        node = u('link', {
                            url: decorator[1],
                            title: undefined,
                            children: [node]
                        }) as Link
                        break
                    }

                    // Strong block
                    case 'b': {
                        node = u('strong', [node]) as Strong
                        break
                    }

                    // Emphasis block
                    case 'i': {
                        node = u('emphasis', [node]) as Emphasis
                        break
                    }

                    // Code block
                    // Does *not* support nesting
                    case 'c': {
                        node = u('inlineCode', {
                            lang: null,
                            meta: null,
                            value: text
                        }) as InlineCode
                        break
                    }

                    default: {
                        console.warn('Unhandled decorator:', decorator)
                    }
                }
            }
        }
        return node
    })
}

type pageBlockSchema = {[key: string]: {
    type: string,
    name: string
}}
function parsePageBlock(
    properties: {[key: string]: SemanticString[]},
    schema: pageBlockSchema = {title: {type: 'title', name: 'title'}},
    users: {[key: string]: NotionUser} = {}
) {
    const metadata: {[key: string]: string} = Object.create(null)
    return Object.keys(properties)
        .reduce((metadata, key) => {

            if (!(key in schema)) {
                console.error("Could not find key", key, "in metadata schema!")
                return metadata
            }

            const {type, name} = schema[key]
            const safeName = camelCase(name)
            switch (type) {

                case 'text':
                case 'title':
                case 'select':
                    metadata[safeName] = properties[key].flat(Infinity).join()
                    return metadata

                case 'file':
                    metadata[safeName] = properties[key].flat(Infinity).find(isUrl).toString()
                    return metadata

                case 'multi_select':
                    metadata[safeName] = properties[key].flat(Infinity).join().split(',').toString()
                    return metadata

                case 'date':
                    const inlineMentionDate = <SemanticString.InlineMentionDate>properties[key].shift()
                    const dateTime: SemanticString.DateTime = inlineMentionDate[1][0][1]

                    if (dateTime) {
                        const date = [dateTime.start_date]
    
                        if (dateTime.start_time) {
                            date.push(dateTime.start_date)
                        }

                        const normalizedTime = zonedTimeToUtc(date.join(' '), dateTime.time_zone || "UTC")
    
                        metadata[safeName] = formatISO(normalizedTime)
                    } else {
                        console.error("Could not parse metadata date", name)
                    }
                    return metadata

                case 'person':
                    const authorId = properties[key].flat(Infinity).find(isUuid).toString()
                    let author = authorId
                    if (users && authorId in users) {
                        const {given_name, family_name} = users[authorId]
                        author = `${given_name} ${family_name}`
                    } else {
                        console.warn("Could not find user", authorId, "defaulting to their user ID!")
                    }
                    metadata[safeName] = author
                    return metadata

                case 'relation':
                    // Relations *are* serialized in the same request...
                    console.error("Could not parse metadata relation", name)
                    return metadata

                case 'url':
                    metadata[safeName] = properties[key].toString()
                    return metadata

                default:
                    console.warn("Could not parse", name, `(${type})`)
                    metadata[safeName] = properties[key].toString()
                    return metadata
            }
        }, metadata)
}

export {notionToMdast, parseBlock, parseTextBlock}