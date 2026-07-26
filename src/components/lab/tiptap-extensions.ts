import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

/**
 * Custom TableCell extension that supports a `backgroundColor` attribute.
 * The color is stored as a node attribute and rendered as an inline `style`
 * on the <td> element. When parsing existing HTML, it reads the background-color
 * from the `style` attribute.
 */
export const TableCellWithColor = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => {
          const style = element.getAttribute("style") || "";
          const match = style.match(/background-color:\s*([^;]+)/i);
          return match ? match[1] : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },
});

/**
 * Custom TableHeader extension that supports a `backgroundColor` attribute.
 * Same logic as TableCellWithColor, applied to <th> elements.
 */
export const TableHeaderWithColor = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => {
          const style = element.getAttribute("style") || "";
          const match = style.match(/background-color:\s*([^;]+)/i);
          return match ? match[1] : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },
});
