import type { ConverterInterface } from './converter-interface'
import type { Block, SemanticString } from 'notionapi-agent/dist/interfaces'
import type { Content, Paragraph, Link, Strong, Emphasis, InlineCode } from 'mdast'
import u from 'unist-builder'

export default class Text implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block.Text {
        return (block as Block.Text).type === 'text'
    }

    supportsMdastNode(node: Content): node is Paragraph {
        return (node as Paragraph).type === 'paragraph'
    }

    toMdastNode(block: Block.Text): Paragraph {
        const text = ('properties' in block && 'title' in block.properties) ? parseTextBlock(block.properties.title) : []
        return u('paragraph', text) as Paragraph
    }
}

export function parseTextBlock(textNode: SemanticString[], withDecorators: boolean = true) {
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