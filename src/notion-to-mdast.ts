import {Plugin} from 'unified'
import {Root, Content, List, ListItem, InlineCode, Emphasis, Strong, Link, YAML, Image, Code, Heading, Paragraph, Blockquote, ThematicBreak, Table, TableRow, TableCell, Text} from 'mdast'
import type { Block, SemanticString, NotionUser } from 'notionapi-agent/dist/interfaces'
import type { BlockRecord } from 'notionapi-agent/dist/interfaces/notion-api/v3/Record'
import u from 'unist-builder'
import yaml from 'js-yaml'
import camelCase from 'camelcase'
import { zonedTimeToUtc } from 'date-fns-tz'
import camelcase from 'camelcase'
import isUrl from 'is-url'
import { validate as isUuid } from 'uuid'
import type { pageBlockSchema, PageChunk, RecordMap } from './types'
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
        if (pageBlock && pageBlock.value && pageBlock.value.content) {
            // When this page is in a database, we reference the blocks belonging to the current page
            blocks.push(
                pageBlock.value,
                ...pageBlock.value.content.map((id: string) => block[id].value)
            )
        } else {
            // Otherwise we use every block
            blocks.push(
                ...Object.values(block).map(b => b.value).filter(b => b.alive === true)
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
            if (!recordMap) {
                console.error('Could not parse page, returning empty!')
                return u('paragraph', []) as Paragraph
            }
            const { collection, notion_user } = recordMap
            const parentId = block.parent_id
            const pageBlock = <Block.Page>block

            const defaultSchema: pageBlockSchema = {
                title: {
                    type: 'title', name: 'title'
                }
            }

            const schema = (collection && parentId in collection) ? collection[parentId].value.schema : defaultSchema

            const users: {[key: string]: NotionUser} = {}
            Object.keys(notion_user).forEach(key => {
                users[key] = notion_user[key].value
            })

            // Extract metadata from page, and camel-case it for consistency.
            const metadata = parsePageBlock(pageBlock, schema, true, users)
            metadata.createdAt = formatISO(pageBlock.created_time)
            metadata.editedAt = formatISO(pageBlock.last_edited_time)
            const camelCasedMetadata = Object.fromEntries(
                Object.entries(metadata).map(
                    ([key, value]) => ([camelCase(key), value])
                )
            )

            // We assume the page object is YAML frontmatter
            return u('yaml', {
                value: yaml.safeDump(camelCasedMetadata, {
                    noRefs: true,
                    skipInvalid: true,
                })
            }) as YAML
        }

        // Markdown only supports tables (not inline kanban, lists, etc...)
        // So we default to rendering as a table.
        case 'collection_view': {
            if (!recordMap) {
                console.error('Could not parse collection_view, returning empty!')
                return u('paragraph', []) as Paragraph
            }

            const collectionBlock = <Block.CollectionViewInline>block
            const {collection, collection_view} = recordMap

            const tableNode = u('table', []) as Table

            const defaultViewId = collectionBlock.view_ids.find(() => true)
            if (collectionBlock.collection_id in collection
                && defaultViewId in collection_view
                && defaultViewId in collection_view
                && 'table_properties' in collection_view[defaultViewId].value.format
            ) {
                const { schema } = collection[collectionBlock.collection_id].value
                const { table_properties } = collection_view[defaultViewId].value.format

                const properties = table_properties
                    .filter(({visible}) => visible === true)
                    .map(({property}) => property)

                collection_view[collectionBlock.collection_id]

                const headRow = u('tableRow', properties.map(property => schema[property])
                    .map(({name}): TableCell => u('tableCell', [
                    u('text', {
                        type: 'text',
                        value: name
                    }) as Text
                ]))) as TableRow

                const bodyRows: TableRow[] = collection_view[defaultViewId].value.page_sort
                    .filter(blockId => blockId in recordMap.block)
                    .map((blockId: string): Block.Page => <Block.Page>recordMap.block[blockId].value)
                    .map(page => parsePageBlock(page, schema))
                    .map(row => u('tableRow',
                        properties.map(property => schema[property])
                        .map(({name}): TableCell => u('tableCell', [
                            u('text', {
                                type: 'text',
                                value: row[name] || ""
                            }) as Text
                        ]) as TableCell
                    )) as TableRow)
                
                if (bodyRows.length === 0) {
                    console.warn("Could not find any data for table!")
                }

                tableNode.children.push(headRow, ...bodyRows)
            }
            return tableNode
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
                depth: 3,
                children: parseTextBlock(subSubHeaderBlock.properties.title, false)
            }) as Heading
        }

        case 'divider': {
            return u('thematicBreak') as ThematicBreak
        }

        case 'bulleted_list':
        case 'numbered_list': {
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
        }

        case 'callout':
        case 'quote': {
            const textBlock = <Block.Text>block
            const text = ('properties' in textBlock && 'title' in textBlock.properties) ? parseTextBlock(textBlock.properties.title) : []
            return u('blockquote', [
                u('paragraph', text) as Paragraph
            ]) as Blockquote
        }

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

function parsePageBlock(
    block: Block.Page,
    schema: pageBlockSchema,
    withFormat: boolean = false,
    users: {[key: string]: NotionUser} = {}
) {
    const { properties, format } = block
    const metadata: {[key: string]: string|string[]} = Object.create(null)

    // Apply Page formatting.
    if (withFormat === true && format) {
        Object.entries(format).reduce((metadata, entry) => {
            const [key, value] = entry
            metadata[key] = value.toString()
            return metadata
        }, metadata)
    }

    if (properties) {
        // Apply properties including collection properties.
        Object.keys(schema)
    
            // Filter out fields not present in the collection schema.
            .filter(key => (key in properties))
            .reduce((metadata, key) => {
    
                const property = <SemanticString[]>properties[key]
    
                const {type, name} = schema[key]
    
                switch (type) {
                    case 'number': 
                    case 'title': 
                    case 'text': {
                        metadata[name] = property.flat(Infinity).join()
                        return metadata
                    }
    
                    case 'file': {
                        metadata[name] = property.flat(Infinity).find(isUrl).toString()
                        return metadata
                    }
    
                    case 'select': {
                        metadata[name] = property.flat(Infinity).join()
                        return metadata
                    }

                    case 'multi_select': {
                        metadata[name] = property.flat(Infinity).join().split(',')
                        return metadata
                    }
    
                    case 'date': {
                        const inlineMentionDate = <SemanticString.InlineMentionDate>property.shift()
                        const dateTime: SemanticString.DateTime = inlineMentionDate[1][0][1]
    
                        if (dateTime) {
                            const date = [dateTime.start_date]
        
                            if (dateTime.start_time) {
                                date.push(dateTime.start_date)
                            }
    
                            const normalizedTime = zonedTimeToUtc(date.join(' '), dateTime.time_zone || "UTC")
        
                            metadata[name] = formatISO(normalizedTime)
                        } else {
                            console.error("Could not parse metadata date", name)
                        }
                        return metadata
                    }
    
                    case 'person': {
                        const authorId = property.flat(Infinity).find(isUuid).toString()
                        let author = authorId
                        if (users && authorId in users) {
                            const {given_name, family_name} = users[authorId]
                            author = `${given_name} ${family_name}`
                        } else {
                            console.warn("Could not find user", authorId, "defaulting to their user ID!")
                        }
                        metadata[name] = author
                        return metadata
                    }
    
                    case 'relation': {
                        // Relations *are* serialized in the same request...
                        console.error("Could not parse metadata relation", name)
                        return metadata
                    }
    
                    case 'url': {
                        metadata[name] = property.toString()
                        return metadata
                    }
    
                    default: {
                        console.warn("Could not parse", name, `(${type})`)
                        metadata[name] = property.toString()
                        return metadata
                    }
                }
            }, metadata)
    }


    return metadata
}

export {notionToMdast, parseBlock, parseTextBlock}