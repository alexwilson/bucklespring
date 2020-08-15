import type { ConverterInterface } from './converter-interface'
import type { Block } from 'notionapi-agent/dist/interfaces'
import type { Content, Table, TableRow, TableCell, Text } from 'mdast'
import type { RecordMap } from '../types'
import {parsePageBlock} from './page'
import u from 'unist-builder'

export default class InlineTable implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block.CollectionViewInline {
        return (block as Block.CollectionViewInline).type === 'collection_view'
    }

    supportsMdastNode(node: Content): node is Table {
        return (node as Table).type === 'table'
    }

    // Markdown only supports tables (not inline kanban, lists, etc...)
    // So we default to rendering as a table.
    toMdastNode(block: Block.CollectionViewInline, previousNode: Content, recordMap: RecordMap): Table {
        const tableNode = u('table', []) as Table

        if (!recordMap) {
            console.error('Could not parse page, returning empty!')
            return tableNode
        }

        const {collection, collection_view} = recordMap

        const defaultViewId = block.view_ids.find(() => true)
        if (block.collection_id in collection
            && defaultViewId in collection_view
            && defaultViewId in collection_view
            && 'table_properties' in collection_view[defaultViewId].value.format
        ) {
            const { schema } = collection[block.collection_id].value
            const { table_properties } = collection_view[defaultViewId].value.format

            const properties = table_properties
                .filter(({visible}) => visible === true)
                .map(({property}) => property)

            collection_view[block.collection_id]

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
}
