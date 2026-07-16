import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Seeds a sample course -> lab -> module -> steps so the app is not empty.
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Wipe existing data (cascade handles children)
  await db.course.deleteMany({});

  const course = await db.course.create({
    data: {
      title: "Data Structures & Algorithms",
      description:
        "A hands-on lab series covering core data structures, algorithms, and their analysis.",
      icon: "🧪",
      color: "#0d9488",
      order: 0,
    },
  });

  const lab = await db.lab.create({
    data: {
      courseId: course.id,
      title: "Lab 1: Linked Lists & Stacks",
      description:
        "Implement a singly linked list and build a stack on top of it. Analyze time complexity for each operation.",
      order: 0,
    },
  });

  const flow = JSON.stringify([
    { id: "f1", label: "Start", type: "start" },
    { id: "f2", label: "Define Node struct", type: "process" },
    { id: "f3", label: "Implement push()", type: "process" },
    { id: "f4", label: "Implement pop()", type: "process" },
    { id: "f5", label: "List empty?", type: "decision" },
    { id: "f6", label: "Run test cases", type: "io" },
    { id: "f7", label: "Done", type: "end" },
  ]);

  const mod = await db.module.create({
    data: {
      labId: lab.id,
      title: "Module 1: Building a Stack with a Linked List",
      order: 0,
      explanation:
        "<h2>Overview</h2><p>In this module you will build a <strong>stack</strong> — a Last-In-First-Out (LIFO) data structure — backed by a singly linked list. A stack supports two primary operations: <code>push</code> (add to the top) and <code>pop</code> (remove from the top).</p><p>By the end you will understand how pointer manipulation gives us O(1) push and pop, and why a linked-list implementation avoids the resizing cost of array-based stacks.</p>",
      overview:
        "<h2>Lab Overview</h2><p>The lab walks through designing a <code>Node</code>, wiring push/pop, and validating with unit tests. The flow diagram below shows the high-level sequence.</p>",
      flow,
      output:
        "<h2>Expected Output</h2><p>After running the program you should see pushed values printed in reverse order of insertion (LIFO), and a final empty-stack check returning <code>true</code>.</p><pre><code>Pushed: 10\nPushed: 20\nPushed: 30\nPopped: 30\nPopped: 20\nStack empty? true</code></pre>",
      conclusion:
        "<h2>Conclusion</h2><p>You implemented a stack using a linked list with O(1) push/pop. The linked-list approach trades a bit of memory (per-node pointers) for flexibility — no resizing, no shifting. In the next module we will extend this to a queue.</p>",
    },
  });

  await db.step.createMany({
    data: [
      {
        moduleId: mod.id,
        order: 0,
        title: "Step 1: Define the Node structure",
        description:
          "<p>Create a <code>Node</code> that holds a value and a pointer to the next node. This is the building block of the linked list.</p>",
        code: `struct Node {\n  int value;\n  Node* next;\n  Node(int v) : value(v), next(nullptr) {}\n};`,
        codeLang: "cpp",
      },
      {
        moduleId: mod.id,
        order: 1,
        title: "Step 2: Implement push()",
        description:
          "<p>Allocate a new node, point its <code>next</code> at the current head, then move the head. This is O(1).</p>",
        code: `void Stack::push(int value) {\n  Node* node = new Node(value);\n  node->next = head;\n  head = node;\n  size++;\n}`,
        codeLang: "cpp",
      },
      {
        moduleId: mod.id,
        order: 2,
        title: "Step 3: Implement pop()",
        description:
          "<p>If the stack is empty, throw. Otherwise save the head's value, advance head to <code>head->next</code>, delete the old node, and return the value.</p>",
        code: `int Stack::pop() {\n  if (!head) throw std::out_of_range("empty");\n  int v = head->value;\n  Node* old = head;\n  head = head->next;\n  delete old;\n  size--;\n  return v;\n}`,
        codeLang: "cpp",
      },
      {
        moduleId: mod.id,
        order: 3,
        title: "Step 4: Write a smoke test",
        description:
          "<p>Push three values, then pop them all and confirm LIFO order. Finally assert the stack is empty.</p>",
        code: `int main() {\n  Stack s;\n  s.push(10); s.push(20); s.push(30);\n  std::cout << "Popped: " << s.pop() << "\\n";\n  std::cout << "Popped: " << s.pop() << "\\n";\n  std::cout << "Stack empty? " << (s.isEmpty() ? "true" : "false") << "\\n";\n  return 0;\n}`,
        codeLang: "cpp",
      },
    ],
  });

  return NextResponse.json({ ok: true, seeded: { course: course.id, lab: lab.id, module: mod.id } });
}
