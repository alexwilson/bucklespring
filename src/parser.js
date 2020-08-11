const yaml = require('js-yaml')
const camelCase = require('camelcase')
const { zonedTimeToUtc } = require('date-fns-tz')
const camelcase = require('camelcase')
const isUrl = require('is-url')
const { validate: isUuid } = require('uuid')


function notionParser() {
    this.Parser = parser
    function parser(doc) {
        const { recordMap } = JSON.parse(doc)
        const { block } = recordMap
        
        // We assume the first Page Block we find is the correct one.
        const pageBlock = Object.values(block).find(
                ({value: {alive, type}}) => (alive === true && type === 'page')
        )
        const pageBlocks = [pageBlock, ...pageBlock.value.content.map(id => block[id])]

        // Begin MDAST
        const rootNode = {
            type: 'root',
            children: []
        }

        // Push nodes into the root-node.
        let previousNode = rootNode
        for (const currentBlock of pageBlocks) {
            const newNode = parseBlock(currentBlock, previousNode, recordMap)

            // Allow nodes to interact with their predecessor sibling
            if (newNode !== previousNode) {
                rootNode.children.push(newNode)
                previousNode = newNode
            }
        }

        return rootNode
    }
}

function parseBlock(block, previousNode, recordMap) {
    const { value } = block
    const { type } = value

    switch (type) {

        case 'page': {
            const { collection } = recordMap
            const { properties } = value
            const parentId = value.parent_id
            const users = recordMap.notion_user
            const schema = (parentId in collection) ? collection[parentId].value.schema : undefined

            const metadata = parsePageBlock(properties, schema, users)

            // We assume the page object is YAML frontmatter
            return {
                type: 'yaml',
                value: yaml.safeDump(metadata, {
                    noRefs: true,
                    skipInvalid: true,
                })
            }
        }

        case 'video': {
            return {
                type: 'link',
                url: value.format.display_source,
                children: [{
                    type: 'text',
                    value: value.format.display_source
                }]
                
            }
        }

        case 'image': {
            const {format} = value
            return {
                type: 'image',
                url: `https://www.notion.so/image/${encodeURIComponent(format.display_source)}`,
                title: "",
                alt: ""
            }
        }

        case 'code': {
            return {
                type: 'code',
                lang: camelcase(value.properties.language.flat(Infinity).shift()),
                value: value.properties.title.flat(Infinity).join('\n')
            }
        }

        case 'header': {
            const text = ('properties' in value && 'title' in value.properties) ? parseTextBlock(value.properties.title, false) : []
            return {
                type: "heading",
                depth: 1,
                children: text
            }
        }

        case 'sub_header': {
            const text = ('properties' in value && 'title' in value.properties) ? parseTextBlock(value.properties.title, false) : []
            return {
                type: "heading",
                depth: 2,
                children: text
            }
        }

        case 'bulleted_list':
        case 'numbered_list':
            const text = ('properties' in value && 'title' in value.properties) ? parseTextBlock(value.properties.title) : []
            const listItem = {
                type: 'listItem',
                children: [{
                    type: 'paragraph',
                    children: text
                }]
            }
            if (previousNode.type === 'list') {
                previousNode.children.push(listItem)
                return previousNode
            }
            return {
                type: 'list',
                ordered: type === 'numbered_list',
                children: [listItem]
            }

        default:
            console.warn('Could not parse block', type, "treating as text!")
        case 'text': {
            const text = ('properties' in value && 'title' in value.properties) ? parseTextBlock(value.properties.title) : []
            return {
                type: 'paragraph',
                children: text
            }
        }
    }
}

function parseTextBlock(textNode, withDecorators = true) {
    return textNode.map(([text, decorators]) => {

        // Build a base text node
        let node = {
            type: 'text',
            value: text
        }

        // Apply decorators by nesting this item.
        if (decorators && withDecorators) {
            decorators.forEach(decorator => {
                switch(decorator[0]) {

                    // Link block. Supports nesting.
                    case 'a': {
                        return node = {
                            type: 'link',
                            url: decorator[1],
                            title: undefined,
                            children: [node]
                        }
                    }

                    // Strong block
                    case 'b': {
                        return node = {
                            type: 'strong',
                            children: [node]
                        }
                    }

                    // Code block
                    // Does *not* support nesting
                    case 'c': {
                        return node = {
                            type: 'inlineCode',
                            lang: null,
                            meta: null,
                            value: text
                        }
                    }

                    // Emphasis block
                    case 'i': {
                        return node = {
                            type: 'emphasis',
                            children: [node]
                        }
                    }

                    default: {
                        console.warn('Unhandled decorator:', decorator)
                    }
                }
            })
        }
        return node
    })
}

function parsePageBlock(properties, schema = {}, users = {}) {
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
                    metadata[safeName] = properties[key].flat(Infinity).toString()
                    return metadata

                case 'file':
                    metadata[safeName] = properties[key].flat(Infinity).find(isUrl)
                    return metadata

                case 'multi_select':
                    metadata[safeName] = properties[key].flat(Infinity).shift().split(',')
                    return metadata

                case 'date':
                    const dateTime = properties[key].flat(Infinity).find(({type}) => type in {"datetime":0, "date":0})
                    if (dateTime) {
                        const date = [dateTime.start_date]
    
                        if (dateTime.start_time) {
                            date.push(dateTime.start_date)
                        }
    
                        metadata[safeName] = zonedTimeToUtc(date.join(' '), dateTime.time_zone || "UTC")
                    } else {
                        console.error("Could not parse metadata date", name)
                    }
                    return metadata

                case 'person':
                    const authorId = properties[key].flat(Infinity).find(isUuid)
                    let author = authorId
                    if (authorId in users) {
                        const {given_name, family_name} = users[authorId].value
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
        }, {})
}

module.exports = {notionParser, parseBlock, parseTextBlock}