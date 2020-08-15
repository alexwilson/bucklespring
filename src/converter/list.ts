import type { ConverterInterface } from './converter-interface'
import type { Block } from 'notionapi-agent/dist/interfaces'
import type { Content, List as ListNode, ListItem, Paragraph } from 'mdast'
import u from 'unist-builder'
import { parseTextBlock } from './text'

export default class List implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block.BulletedList|Block.NumberedList {
        return (block as Block.BulletedList).type === 'bulleted_list'
          || (block as Block.NumberedList).type === 'numbered_list'
    }

    supportsMdastNode(node: Content): node is ListNode {
        return (node as ListNode).type === 'list'
    }

    toMdastNode(block: Block.BulletedList|Block.NumberedList, previousNode: Content): ListNode {
        const text = parseTextBlock(block.properties.title)
        const listItem = u('listItem', {
            children: [u('paragraph', text) as Paragraph]
        }) as ListItem

        if (previousNode.type === 'list') {
            previousNode.children.push(listItem)
            return previousNode
        }

        return u('list', {
            ordered: block.type === 'numbered_list',
            children: [listItem]
        }) as ListNode
    }
}
