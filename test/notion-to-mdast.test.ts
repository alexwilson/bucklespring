import notionToMdast from '../src/notion-to-mdast'
const unified = require('unified')
const frontMatter = require('remark-frontmatter')
const serializeMarkdown = require('remark-stringify')
import path from 'path'
import fs from 'fs'

describe("NotionToMdast", () => {
    it("converts the kitchen sink from notion into markdown", async () => {

        const kitchenSinkNotion = fs.readFileSync(path.resolve(__dirname, 'mock/kitchen-sink.json'), 'utf8')
        const kitchenSinkMd = fs.readFileSync(path.resolve(__dirname, 'mock/kitchen-sink.md'), 'utf8')

        const tree = await unified()
            .use(notionToMdast)
            .use(serializeMarkdown)
            .use(frontMatter)
            .process(kitchenSinkNotion)

        expect(tree.toString()).toEqual(kitchenSinkMd)
    })
})