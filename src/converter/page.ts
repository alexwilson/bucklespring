import type { ConverterInterface } from './converter-interface'
import type { NotionUser, SemanticString, Block } from 'notionapi-agent/dist/interfaces'
import type { Content, YAML } from 'mdast'
import type { RecordMap, pageBlockSchema } from '../types'
import { formatISO } from 'date-fns'
import yaml from 'js-yaml'
import { zonedTimeToUtc } from 'date-fns-tz'
import isUrl from 'is-url'
import { validate as isUuid } from 'uuid'
import camelCase from 'camelcase'
import u from 'unist-builder'

export default class Page implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block.Page {
        return (block as Block.Page).type === 'page'
    }

    supportsMdastNode(node: Content): node is YAML {
        return (node as YAML).type === 'yaml'
    }

    toMdastNode(block: Block.Page, previousNode: Content, recordMap: RecordMap): YAML {
        if (!recordMap) {
            console.error('Could not parse page, returning empty!')
            return u('yaml') as YAML
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
}

export function parsePageBlock(
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
                        const inlineMentionDate = <SemanticString.InlineMentionDate>property.find(() => true)
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