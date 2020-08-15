import type {ConverterInterface} from './converter-interface'
import { Content} from 'mdast'
import type { Block } from 'notionapi-agent/dist/interfaces'
import { RecordMap } from '../types'
import Page from './page'
import InlineTable from './inline-table'
import List from './list'
import Heading from './heading'
import Text from './text'
import Divider from './divider'
import Video from './video'
import Image from './image'
import Code from './code'
import Quote from './quote'

const converters: ConverterInterface[] = [
    new Page(),
    new InlineTable(),
    new Video(),
    new Image(),
    new List(),
    new Divider(),
    new Heading(),
    new Quote(),
    new Code(),
    new Text()
]

export default class Converter implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block {
        return converters.filter(converter => converter.supportsNotionBlock(block)).length > 0
    }

    supportsMdastNode(node: Content): node is Content {
        return converters.filter(converter => converter.supportsMdastNode(node)).length > 0
    }

    toMdastNode(block: Block, previousNode: Content, recordMap: RecordMap): Content {
        let converter = converters
            .find(converter => converter.supportsNotionBlock(block))
        
        if (!converter) {
            console.warn("Could not find parser for block of type", block.type, "so rendering as text!")

            const textBlock = <Block.Text>block
            textBlock.type = "text"
            converter = converters.find(converter => converter.supportsNotionBlock(textBlock))
        }
        
        return converter.toMdastNode(<Block>block, previousNode, recordMap)
    }
}

export {Page}