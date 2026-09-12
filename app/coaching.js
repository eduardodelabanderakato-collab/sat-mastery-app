// The method for each of the 29 official skills.
//
// Each entry answers four questions in order: what is this question really
// testing, why does the method work, what exactly do I do, and what will I
// carry into the exam. Then the traps, which are the wrong answers the item
// was built from, and for Math the Desmos route step by step.
//
// Written per skill rather than per question because what transfers between
// questions is the method; the official rationale underneath explains the
// particular item. Every step is one you can carry out under time pressure
// without needing a flash of insight.

import { SCENE_FRAMES, pointToPercent } from "./desmos-scenes.js?v=dcf29171";

export const COACHING = {
  // ------------------------------------------------------------- Reading and Writing
  "Words in Context": {
    pattern: "The passage defines the word. Your vocabulary is not on trial; your reading of one sentence is.",
    why:
      "Every one of these has a clue planted in the sentence before or after the blank, because the test has to be answerable by someone who has never met the word. Find the clue and the blank is already filled; skip it and all four choices look plausible.",
    steps: [
      "Cover the choices with your hand. Read the sentence and say your own word out loud.",
      "Find the clue: a restatement, an example, or a contrast word such as but, however, although, yet.",
      "Decide the direction: does the blank agree with the clue or oppose it? Put a + or a − in the margin.",
      "Uncover the choices and keep only the one closest to your word and pointing the same direction.",
      "Read the whole sentence back with your choice in place. It has to sound like something a person would write.",
    ],
    remember: "Predict before you look. A word you chose beats four words you are comparing.",
    traps: [
      { key: "Right word, wrong sentence", text: "A genuine synonym in general use that does not fit this sentence's logic." },
      { key: "Too strong", text: "Refute, condemn, prove, where the text only notes or suggests." },
      { key: "Second meaning", text: "An everyday word in its less common sense. If a choice looks too easy, check its other meaning." },
    ],
  },
  "Text Structure and Purpose": {
    pattern: "What one part of the text is doing for the whole, or how the whole is built.",
    why:
      "A sentence can be perfectly summarised and still have its job described wrongly. The test separates content from function on purpose, so you have to ask what the part does, not what it says.",
    steps: [
      "Read for the job of each part: does it set up, illustrate, object, qualify, or conclude?",
      "For an underlined portion, ask what would be lost if you deleted it. That is its function.",
      "Say the function in your own words first: 'it gives an example of the problem'.",
      "Match your sentence to a choice. Reject anything that only restates the content.",
    ],
    remember: "Ask what the sentence does, not what it says.",
    traps: [
      { key: "True but not the job", text: "Restates the content accurately and names the wrong function." },
      { key: "Too big", text: "Says the part introduces the main argument when it only illustrates one point." },
      { key: "Wrong direction", text: "Says the text endorses something it raises in order to challenge." },
    ],
  },
  "Cross-Text Connections": {
    pattern: "How the author of Text 2 would respond to a specific claim in Text 1.",
    why:
      "The two texts almost never simply agree or simply disagree. The usual relationship is that Text 2 accepts the finding and explains it differently, and the answer turns on getting that shade right.",
    steps: [
      "Read Text 1 and write its position in three words in the margin. Do the same for Text 2.",
      "Name the relationship before reading any choice: agrees, disagrees, or accepts but reinterprets.",
      "Go back and find the exact sentence in Text 2 that bears on the claim the question names.",
      "Keep only the choice that matches both the relationship and that sentence.",
    ],
    remember: "Three words for each text, then name the relationship, then read the choices.",
    traps: [
      { key: "Wrong author", text: "Gives Text 1's view to the author of Text 2, or the reverse. The most common wrong answer here." },
      { key: "Too far", text: "Turns a mild qualification into a flat contradiction." },
      { key: "Outside the question", text: "A true comparison of the texts that does not address the point asked about." },
    ],
  },
  "Rhetorical Synthesis": {
    pattern: "The goal in the final sentence is the entire question. The notes are raw material.",
    why:
      "All four choices normally use the notes accurately. They differ in what they accomplish. That is why reading the goal first, before the notes, is worth more here than anywhere else on the test.",
    steps: [
      "Read the goal sentence first, before the notes. Underline the two things it asks for.",
      "Now read the notes, marking only the facts that serve that goal.",
      "Eliminate any choice that drops one of the two requirements, however well written it is.",
      "Of what is left, take the one that uses the notes accurately and adds nothing new.",
    ],
    remember: "Read the last sentence first. The goal is the question.",
    traps: [
      { key: "Accurate but off-goal", text: "Uses the notes correctly to do something the goal never asked for. The signature wrong answer of this skill." },
      { key: "Half the goal", text: "Meets the first requirement and quietly drops the second." },
      { key: "Invented detail", text: "States something the notes never said." },
    ],
  },
  Transitions: {
    pattern: "The logical relationship between the two sentences, and nothing else.",
    why:
      "The choices are all real transitions, so the question is never about whether a word exists. It is about the direction of travel between two ideas, which you can settle before you look at a single option.",
    steps: [
      "Cover the choices. Read the sentence before and the sentence after.",
      "Name the link in one word: same direction, opposite, cause, example, or sequence.",
      "Translate to a transition: however is opposite, therefore is cause, for instance is example, moreover is same direction.",
      "Read it through once with your transition in place to confirm.",
    ],
    remember: "Name the relationship before you read the options. Cover the choices.",
    traps: [
      { key: "Opposite direction", text: "However where the sentences agree, furthermore where they conflict." },
      { key: "Cause reversed", text: "Therefore when the second sentence is the reason, not the result." },
      { key: "Sounds academic", text: "Indeed or in fact chosen for tone rather than because it names the link." },
    ],
  },
  "Central Ideas and Details": {
    pattern: "The main point of the whole text, or one detail the text actually states.",
    why:
      "A main idea has to cover the whole passage. Most wrong answers are true sentences about one part of it, which is why a detail offered as the main idea is the standard trap.",
    steps: [
      "For a main idea, read the first and last sentences: the point is usually in one of them.",
      "Say it in your own words in under ten words before you look at the choices.",
      "For a detail question, find the line and keep your finger on it.",
      "Reject anything you cannot point at a line for.",
    ],
    remember: "If you cannot point to the line, it is not the answer.",
    traps: [
      { key: "One detail as the whole", text: "A true supporting detail offered as the main idea." },
      { key: "Too broad", text: "A claim about the field in general that this text does not make." },
      { key: "Nearly right", text: "Correct but for one changed word: most for some, causes for is linked to." },
    ],
  },
  "Command of Evidence": {
    pattern: "Which single fact would most strengthen or weaken the specific claim the question names.",
    why:
      "Strengthening means making the claim more believable, not adding a related fact. Most wrong answers are perfectly true and leave the claim exactly as believable as it was, which is why you have to state the claim before you look.",
    steps: [
      "Write the claim in your own words. Everything here depends on stating it exactly.",
      "Ask what the world looks like if the claim is true, and what looks different if it is false.",
      "For a table or graph, read the axes, units and labels before any numbers, then find the row or bar the claim is about.",
      "Test each choice against the claim alone: does this move the needle, or is it just another fact?",
    ],
    remember: "State the claim first. Then ask of each choice: does this make it more believable?",
    traps: [
      { key: "Related but inert", text: "True, on topic, and leaves the claim exactly where it was." },
      { key: "Supports the wrong claim", text: "Strengthens a different claim in the passage than the one named." },
      { key: "Misread axis", text: "In data questions, the right numbers from the wrong column, year or group." },
    ],
  },
  Inferences: {
    pattern: "The one conclusion the text forces. Not likely, not reasonable: forced.",
    why:
      "The standard is logical necessity, not plausibility. Three choices will be things a sensible person might believe; only one cannot be false while the text is true.",
    steps: [
      "Read to the blank and stop. Do not guess an ending yet.",
      "List what the text has established, as facts.",
      "Ask of each choice: could this be false while everything the text says is still true?",
      "If yes, eliminate it. What survives is the answer.",
    ],
    remember: "Could this be false and the text still true? If yes, it is wrong.",
    traps: [
      { key: "Plausible but unforced", text: "Likely true in the real world, not established by the text." },
      { key: "Overstated", text: "All, never, proves, where the text supports only some or suggests." },
      { key: "Backwards", text: "Reverses cause and effect, or reports a correlation as a cause." },
    ],
  },
  Boundaries: {
    pattern: "Punctuation between parts of a sentence. Decide what is on each side before choosing.",
    why:
      "Every rule here follows from one question: is each side a complete sentence? Answer that and the four choices sort themselves, because the test only ever punctuates the same handful of joins.",
    steps: [
      "Read the two sides and mark each: complete sentence, or not.",
      "Complete + complete: full stop, semicolon, or comma with and, but, or, so. Never a bare comma.",
      "Complete + fragment: usually a comma, or a colon when the fragment explains or lists.",
      "A non-essential aside takes commas on both sides, or dashes on both sides. Never one of each.",
    ],
    remember: "Complete sentence on both sides? Then a comma alone is always wrong.",
    traps: [
      { key: "Comma splice", text: "Two full sentences joined by a comma alone. Always wrong on this test." },
      { key: "Mismatched pair", text: "A comma opening an aside and a dash closing it." },
      { key: "Colon after a fragment", text: "A colon must follow a complete sentence." },
    ],
  },
  "Form, Structure, and Sense": {
    pattern: "Agreement, verb tense and pronouns. Find what the word refers back to.",
    why:
      "The test hides the subject behind a prepositional phrase on purpose: 'the box of old letters ... is'. Crossing out what sits between subject and verb removes the whole difficulty in one stroke.",
    steps: [
      "For a verb, cross out everything between the subject and the verb, then reread. The phrase is there to hide the subject.",
      "Match the verb to that subject, singular or plural.",
      "For tense, find another verb nearby and match the timeline of the passage.",
      "For a pronoun, name the exact noun it replaces. If you cannot name one noun, the choice is wrong.",
    ],
    remember: "Cross out the middle. The subject is what is left.",
    traps: [
      { key: "Nearest noun", text: "Agreeing with the noun just before the verb rather than the real subject." },
      { key: "Tense drift", text: "A tense that is fine alone but does not match the passage." },
      { key: "Vague pronoun", text: "It or they with two possible referents." },
    ],
  },

  // ------------------------------------------------------------------------- Math
  "Linear equations in one variable": {
    pattern: "One unknown, one line. Undo the operations in reverse order.",
    why:
      "An equation stays true if you do the same thing to both sides. That is the only rule, and it is why clearing fractions first is safe: multiplying every term by the denominator is the same thing done to both sides.",
    steps: [
      "Clear fractions: multiply every term, on both sides, by the common denominator.",
      "Expand brackets, watching the sign in front of them.",
      "Gather the variable on one side and the numbers on the other.",
      "Divide once, at the end.",
      "No solution or infinitely many: the variable cancels. Same constant on both sides means infinitely many, different constants means none.",
    ],
    remember: "Whatever you do, do it to every term on both sides.",
    traps: [
      { key: "Sign on distribution", text: "Forgetting that -3(x-4) gives +12." },
      { key: "Answered the wrong thing", text: "Solving for x when the question asked for 3x, or x + 2." },
      { key: "One term missed", text: "Multiplying only some terms when clearing a fraction." },
    ],
    desmos: {
      "scene": "solve-equation",
      "intro": "Solving 2(x + 3) = 5x − 9 without doing any algebra.",
      "steps": [
        {
          "do": "y=2(x+3)",
          "frame": 1,
          "why": "Type the left side of the equation as its own graph. Desmos plots any y = … as a line, and the height of that line is the value of the left side at each x."
        },
        {
          "do": "y=5x-9",
          "frame": 2,
          "why": "Now the right side, on the next line. Its height is the value of the right side. One graph for each side of the equation."
        },
        {
          "do": "Click where the two lines cross.",
          "frame": 3,
          "why": "The equation asks where the two sides are equal, and equal height is exactly where the graphs meet. Desmos prints the coordinates for you.",
          "markers": [
            {
              "at": [
                5,
                16
              ],
              "label": "x = 5",
              "place": "left"
            }
          ]
        }
      ],
      "reading": "Desmos shows (5, 16). The x is the solution: x = 5. Ignore the y unless the question asks for the value of each side.",
      "note": "This works for any equation, not only linear ones. Left side as one graph, right side as another, read the crossing."
    },
  },
  "Linear equations in two variables": {
    pattern: "A line in disguise. The slope is the rate, the intercept is the starting value.",
    why:
      "y = mx + b is a sentence about the real world: start at b, then change by m for every one unit of x. Naming the units of m and b out loud turns an abstract line into the story the question is telling.",
    steps: [
      "Rearrange to y = mx + b if you can.",
      "Say the units aloud: m is dollars per hour, b is dollars at the start.",
      "Slope from two points is the change in y over the change in x, in that order.",
      "To test whether a point lies on the line, substitute it. It either satisfies the equation or it does not.",
    ],
    remember: "m is per one. b is at zero.",
    traps: [
      { key: "Flipped slope", text: "Change in x over change in y." },
      { key: "Intercept as rate", text: "Reading b as the per-unit amount and m as the starting value." },
      { key: "Sign of the slope", text: "A quantity that decreases has a negative slope." },
    ],
    desmos: {
      "scene": "solve-equation",
      "intro": "Reading the rate and the starting value straight off a line.",
      "steps": [
        {
          "do": "y=2(x+3)",
          "frame": 1,
          "why": "Type the equation in whatever form the question gives it. Desmos accepts standard form as readily as y = mx + b, so there is no rearranging to get wrong."
        },
        {
          "do": "Look where the line crosses the y-axis.",
          "frame": 2,
          "why": "That height is b, the value when x is zero: the starting amount in the story the question is telling."
        },
        {
          "do": "Move one step right and see how far the line climbs.",
          "frame": 3,
          "why": "That rise is m, the change per unit: the rate. Reading it off the picture cannot go wrong by a sign the way rearranging can.",
          "markers": [
            {
              "at": [
                5,
                16
              ],
              "label": "a point on the line",
              "place": "left"
            }
          ]
        }
      ],
      "reading": "b is where it crosses the y-axis, m is the climb per step across. If the question gives you a point, click the line to check it lies on it."
    },
  },
  "Linear functions": {
    pattern: "Constant rate of change. Everything follows from the rate and one known point.",
    why:
      "Linear means the same amount is added every step, so two pieces of information pin the whole function down. Function notation is just a label for a point: f(3) = 8 is the point (3, 8).",
    steps: [
      "Find the rate: for each one unit of x, how much does y change?",
      "Find one point you are given, usually the value at x = 0.",
      "Write f(x) = rate × x + starting value.",
      "Reread the question and answer what it actually asked, whether f(7), the x that gives a certain f(x), or the rate itself.",
    ],
    remember: "f(3) = 8 is the point (3, 8). Nothing more mysterious than that.",
    traps: [
      { key: "Off by one step", text: "Using the value at x = 1 as the starting value." },
      { key: "Table misread", text: "The x values in a table are not always one apart. Divide by the actual gap." },
      { key: "Function notation", text: "Reading f(3) = 8 as x = 8." },
    ],
    desmos: {
      "scene": "solve-equation",
      "intro": "Checking a function you built, and solving f(x) = a given value.",
      "steps": [
        {
          "do": "y=2(x+3)",
          "frame": 1,
          "why": "Type the function you worked out. If it passes through the points the question gave you, you built it right. This catches an arithmetic slip in seconds."
        },
        {
          "do": "y=16",
          "frame": 2,
          "why": "For f(x) = 16, add a horizontal line at that height. Everywhere along it, y is 16."
        },
        {
          "do": "Click where your function meets that line.",
          "frame": 3,
          "why": "The x of that meeting point is the input that produces 16, so the equation is solved by reading rather than by algebra.",
          "markers": [
            {
              "at": [
                5,
                16
              ],
              "label": "f(x) = 16 here",
              "place": "left"
            }
          ]
        }
      ],
      "reading": "The x of the crossing is your answer. Check it against a point the question gave you before you move on."
    },
  },
  "Linear inequalities in one or two variables": {
    pattern: "The same algebra as an equation, with one extra rule and a direction to track.",
    why:
      "Multiplying by a negative reverses the order of the number line: 2 < 3, but −2 > −3. That single fact is the only thing an inequality adds to solving an equation, and it is where nearly every mark is lost.",
    steps: [
      "Solve exactly as you would an equation.",
      "Flip the inequality sign whenever you multiply or divide both sides by a negative.",
      "For a system, graph both and look at the region where the shading overlaps.",
      "Check the endpoint: at most and at least include it, fewer than and more than do not.",
    ],
    remember: "Divide by a negative, flip the sign. Nothing else flips it.",
    traps: [
      { key: "Sign not flipped", text: "Dividing by a negative and keeping the direction." },
      { key: "Endpoint", text: "Confusing at least with more than at the boundary." },
      { key: "Which side", text: "Shading above when the inequality says below." },
    ],
    desmos: {
      "scene": "inequality",
      "intro": "A system of inequalities is far faster graphed than reasoned about.",
      "steps": [
        {
          "do": "y<-2x+4",
          "frame": 1,
          "why": "Type the inequality sign, not an equals. Desmos shades every point that satisfies it, so you see the whole solution set at once instead of testing points one at a time."
        },
        {
          "do": "y>=x-1",
          "frame": 2,
          "why": "The second inequality shades in another colour. Its boundary is solid because ≥ includes the line itself; the first is dashed because < does not."
        },
        {
          "do": "Find where the two shadings overlap.",
          "frame": 3,
          "why": "A solution has to satisfy both inequalities, so only the overlap counts. It is visibly darker. Now check each answer choice by eye instead of by algebra.",
          "markers": [
            {
              "at": [
                0.6,
                -0.2
              ],
              "label": "both true here",
              "place": "right"
            }
          ]
        }
      ],
      "reading": "Any point in the darker region satisfies both. A solid boundary means the points on it count; a dashed one means they do not."
    },
  },
  "Systems of two linear equations in two variables": {
    pattern: "Two lines. The answer is where they meet, or how they fail to.",
    why:
      "A solution has to satisfy both equations at once, and a point lies on both lines exactly when the lines cross there. No crossing means no solution; the same line twice means every point works.",
    steps: [
      "If a variable is already alone, substitute. Otherwise add or subtract the equations to eliminate one.",
      "Solve for the variable that survives, then put it back to get the other.",
      "No solution: same slope, different intercept, the lines are parallel.",
      "Infinitely many: one equation is a multiple of the other, so they are the same line.",
    ],
    remember: "Two lines cross once, never, or everywhere. Those are the only three answers.",
    traps: [
      { key: "Stopped halfway", text: "Finding x and never going back for y, when the question wants x + y." },
      { key: "Subtraction slip", text: "Sign errors when subtracting one whole equation from another." },
      { key: "Parallel missed", text: "Solving on after the variables have already cancelled." },
    ],
    desmos: {
      "scene": "system",
      "intro": "The single biggest time saving Desmos offers anywhere on the Math section.",
      "steps": [
        {
          "do": "2x+3y=12",
          "frame": 1,
          "why": "Type the first equation exactly as printed. No rearranging into y = mx + b, which is where sign errors happen. Every point on this line satisfies that equation."
        },
        {
          "do": "x-y=1",
          "frame": 2,
          "why": "The second equation on the next line. Every point on this second line satisfies the second equation."
        },
        {
          "do": "Click where the two lines cross.",
          "frame": 3,
          "why": "That point lies on both lines at once, so it satisfies both equations at once. That is exactly what solving a system means.",
          "markers": [
            {
              "at": [
                3,
                2
              ],
              "label": "(3, 2)",
              "place": "right"
            }
          ]
        }
      ],
      "reading": "x = 3 and y = 2. If the question asks for x + y, add them yourself: 5. Read the question again before you answer.",
      "note": "If the lines look parallel, zoom out to be sure: parallel means no solution. One line sitting exactly on the other means infinitely many."
    },
  },
  "Equivalent expressions": {
    pattern: "Rewriting, not solving. Two forms of the same expression wearing different clothes.",
    why:
      "Equivalent means equal for every value of x, which is why substituting one number is such a strong check: if two expressions disagree at x = 2 they are not equivalent, and if they agree at three values they almost certainly are.",
    steps: [
      "Factor what you can: common factor first, then difference of squares, then trinomials.",
      "In a fraction, factor top and bottom and cancel whole factors only, never single terms.",
      "With exponents: multiplying adds the powers, a power of a power multiplies them, a negative power means one over.",
      "Check by substituting a number such as x = 2 into both forms. They must agree.",
    ],
    remember: "Only factors cancel. Terms never do.",
    traps: [
      { key: "Cancelling a term", text: "Striking x from (x+3)/x. It is a term there, not a factor." },
      { key: "Squared a sum", text: "(x+3)² is not x²+9. The middle term is 6x." },
      { key: "Negative exponent", text: "x⁻² means one over x², not a negative number." },
    ],
    desmos: {
      "scene": "equivalent",
      "intro": "Testing whether your rewrite is right, in about five seconds.",
      "steps": [
        {
          "do": "y=(x+3)(x-2)",
          "frame": 1,
          "why": "Type the original expression as a graph, and make the line thick by holding down its colour swatch. Equivalent expressions must give the same curve at every single x."
        },
        {
          "do": "y=x^2+x-6",
          "frame": 2,
          "why": "Type your rewritten version underneath. If the rewrite is correct the thin curve lands exactly on the thick one and you see a single curve, not two.",
          "markers": [
            {
              "at": [
                -0.5,
                -6.25
              ],
              "label": "one curve, not two",
              "place": "right"
            }
          ]
        }
      ],
      "reading": "One curve means the two forms are equivalent. Any separation anywhere, however small, means the rewrite is wrong."
    },
  },
  "Nonlinear equations in one variable and systems of equations in two variables": {
    pattern: "A quadratic, or a curve meeting a line. Get it to equal zero, then factor or graph.",
    why:
      "The whole method rests on one fact: if a product is zero then one of its factors is zero. That is why everything has to be moved to one side first, and it is why a quadratic usually has two answers rather than one.",
    steps: [
      "Move every term to one side so the equation reads = 0.",
      "Factor if it factors. Otherwise use the quadratic formula, carefully with the signs.",
      "For a curve and a line, set the two expressions equal to each other and solve.",
      "The discriminant b² − 4ac counts the solutions: positive is two, zero is one, negative is none.",
    ],
    remember: "Set it to zero first. Then expect two answers, not one.",
    traps: [
      { key: "One root only", text: "Giving x = 3 when x = -3 also works." },
      { key: "Not set to zero", text: "Factoring before moving every term to one side." },
      { key: "Extra solution", text: "Squaring both sides can invent a root. Substitute back and check." },
    ],
    desmos: {
      "scene": "quadratic",
      "intro": "Roots, vertex and the number of solutions, all read off one graph.",
      "steps": [
        {
          "do": "y=x^2-5x+6",
          "frame": 1,
          "why": "Move every term to one side first, then type that side as y = … . The equation asks where the expression equals zero, and zero height is exactly the x-axis."
        },
        {
          "do": "Click each point where the curve meets the x-axis.",
          "frame": 2,
          "why": "Those crossings are the solutions. Count them before answering: two crossings means two solutions, which is why giving only x = 3 loses the mark.",
          "markers": [
            {
              "at": [
                2,
                0
              ],
              "label": "x = 2",
              "place": "left"
            },
            {
              "at": [
                3,
                0
              ],
              "label": "x = 3",
              "place": "right"
            }
          ]
        },
        {
          "do": "Click the lowest point of the curve.",
          "frame": 3,
          "why": "Desmos marks minimums and maximums with a grey dot. That is the vertex, without completing a single square.",
          "markers": [
            {
              "at": [
                2.5,
                -0.25
              ],
              "label": "vertex (2.5, −0.25)",
              "place": "below"
            }
          ]
        }
      ],
      "reading": "The crossings are x = 2 and x = 3. If a curve never reaches the axis there are no real solutions, which is the discriminant being negative, seen rather than calculated."
    },
  },
  "Nonlinear functions": {
    pattern: "Quadratics and exponentials. Each form of the equation hands you a different fact for free.",
    why:
      "Exponential change multiplies rather than adds. Decreasing by 80% does not mean multiplying by 0.8; it means 20% is left, so you multiply by 0.2. That one line is the most valuable sentence in this whole topic.",
    steps: [
      "Quadratic: y = a(x − h)² + k gives the vertex (h, k); factored form gives the roots; the lone constant gives the y-intercept.",
      "Exponential: y = a(b)^x, where a is the starting value and b is the multiplier for each step.",
      "Turn the percentage into b before anything else. Up 20% is b = 1.20. Down 80% is b = 0.20.",
      "Substitute the value asked for, then reread the question to check which quantity it wants.",
    ],
    remember: "Down 80% leaves 20%, so b = 0.2. Percent left, not percent lost.",
    traps: [
      { key: "Decay rate as the multiplier", text: "Using b = 0.8 for a decrease of 80%. The single most common error in the topic." },
      { key: "Vertex sign", text: "In (x - 4)² the vertex sits at x = +4." },
      { key: "Linear thinking", text: "Adding the rate each step instead of multiplying." },
    ],
    desmos: {
      "scene": "exponential",
      "intro": "The question that started this: f(0) = 86, falling 80% at each step, find f(2).",
      "steps": [
        {
          "do": "Work out the multiplier before typing anything. Falling 80% leaves 20%, so b = 0.2.",
          "frame": 1,
          "why": "Get this wrong and the graph will be beautifully drawn and completely wrong. Percent left, not percent lost. This is where the mark is won or lost."
        },
        {
          "do": "y=86(0.2)^x",
          "frame": 1,
          "why": "86 is the value at x = 0 and 0.2 multiplies it at every step. Desmos draws the whole decay, so you see it collapse quickly rather than fall steadily."
        },
        {
          "do": "x=2",
          "frame": 2,
          "why": "A vertical line at the input you want. An equation with x alone gives a vertical line, which is far easier to click accurately than tracing along the curve."
        },
        {
          "do": "Click where the curve meets that line.",
          "frame": 3,
          "why": "Desmos prints the coordinates: (2, 3.44). The y is f(2), which is what the question asked for.",
          "markers": [
            {
              "at": [
                2,
                3.44
              ],
              "label": "(2, 3.44)",
              "place": "right"
            }
          ]
        }
      ],
      "reading": "f(2) = 3.44. Both 3.44 and 86/25 are accepted, because they are the same number written two ways."
    },
  },
  "Ratios, rates, proportional relationships, and units": {
    pattern: "One proportion, written with the units in, and the cancelling does the work.",
    why:
      "Units behave exactly like numbers in a fraction: they cancel top against bottom. If you write them down, the arrangement that leaves the unit you want is the arrangement that is correct, so you never have to guess whether to multiply or divide.",
    steps: [
      "Write the given rate as a fraction, units and all.",
      "Multiply by conversion fractions arranged so the unwanted units cancel diagonally.",
      "Do the arithmetic last, once the only units left are the ones asked for.",
      "Sanity check the size: should the answer be larger or smaller than what you started with?",
    ],
    remember: "Write the units. The one that cancels is the one you wanted to lose.",
    traps: [
      { key: "Upside down", text: "A conversion fraction inverted, so units multiply instead of cancelling." },
      { key: "Wrong final unit", text: "Answering in minutes when the question said hours." },
      { key: "Part and whole", text: "3 parts to 5 parts is 3/8 of the total, not 3/5." },
    ],
  },
  Percentages: {
    pattern: "Percent of what? Name the base before you calculate anything.",
    why:
      "A percentage is meaningless without the number it is taken of. Successive changes multiply rather than add because the second change is taken of the new amount, which is why up 20% then down 20% does not return you to the start.",
    steps: [
      "Write down the base: the number the percent is taken of.",
      "Increase by p% means multiply by (1 + p/100). Decrease means multiply by (1 − p/100).",
      "For successive changes, multiply the factors. Never add the percentages.",
      "Percent change is the change divided by the original, never by the new value.",
    ],
    remember: "Percent change divides by where you started, not where you ended.",
    traps: [
      { key: "Added percentages", text: "Up 20% then down 20% leaves 0.96 of the original, not all of it." },
      { key: "Wrong base", text: "Dividing by the new amount when finding percent change." },
      { key: "Percent of a percent", text: "20% of 30% is 6%, not 50%." },
    ],
  },
  "One-variable data: Distributions and measures of center and spread": {
    pattern: "Centre and spread. The question is usually which measure moves when the data changes.",
    why:
      "The mean uses every value, so one extreme value drags it. The median only cares about position, so it barely moves. Nearly every question in this skill is that one contrast.",
    steps: [
      "Order the values before finding the median. Always.",
      "Remember that the mean is pulled toward outliers and the median is not.",
      "Spread means range or standard deviation: more tightly clustered means a smaller standard deviation.",
      "Check whether the question wants centre or spread, and answer only that.",
    ],
    remember: "Outliers move the mean. The median hardly notices.",
    traps: [
      { key: "Unordered median", text: "Taking the middle of the list as printed." },
      { key: "Frequency ignored", text: "In a frequency table each value counts as many times as its frequency." },
      { key: "Outlier on the median", text: "Claiming an outlier shifts the median much. It usually barely moves." },
    ],
  },
  "Two-variable data: Models and scatterplots": {
    pattern: "A line or curve through a cloud of points. Read the model, do not eyeball the dots.",
    why:
      "The model is the test's claim about the data, so questions about prediction are questions about the line, not about any particular point. A point that sits far off the line is a residual, not a counterexample.",
    steps: [
      "Read the axes and their units first.",
      "For a line of best fit, the slope is the predicted change per unit and the intercept is the value at zero.",
      "To predict, substitute into the model rather than reading between the dots by eye.",
      "Residual is actual minus predicted. Above the line is positive.",
    ],
    remember: "Predict from the line, not from the nearest dot.",
    traps: [
      { key: "Reading a point", text: "Answering from one data point when the question asks about the model." },
      { key: "Cause from correlation", text: "A tight fit never shows that one variable causes the other." },
      { key: "Extrapolating", text: "Trusting the model far outside the range of the data shown." },
    ],
    desmos: {
      "scene": "scatter",
      "intro": "Desmos fits the line for you and prints the numbers, so nothing is estimated by eye.",
      "steps": [
        {
          "do": "Add a table, then type the data into the x₁ and y₁ columns.",
          "frame": 1,
          "why": "Desmos plots the points as you type, so a mistyped value shows up immediately as a dot out of place."
        },
        {
          "do": "y_1~mx_1+b",
          "frame": 2,
          "why": "A tilde, not an equals. The tilde asks Desmos to find the m and b that fit best; an equals would just draw one line you chose. The values of m, b and R² appear underneath."
        },
        {
          "do": "Substitute into y = mx + b to predict.",
          "frame": 3,
          "why": "Predict from the line, never from the nearest dot. Here x = 10 gives about 23.6, which is beyond the data, so say so if the question asks whether the prediction is safe.",
          "markers": [
            {
              "at": [
                10,
                23.6
              ],
              "label": "predicted at x = 10",
              "place": "left"
            }
          ]
        }
      ],
      "reading": "m is the predicted change per unit, b is the value at zero, and R² says how tightly the line fits, from 0 to 1."
    },
  },
  "Probability and conditional probability": {
    pattern: "A two-way table. The question tells you which row or column is the denominator.",
    why:
      "The words 'of the students who walk' quietly replace the whole table with one row. Getting the denominator right is the entire question; the numerator is then just reading a cell.",
    steps: [
      "Find the group the question restricts you to: everyone, or one row, or one column.",
      "That group's total is your denominator. Circle it in the table.",
      "Count the cell that also meets the other condition. That is your numerator.",
      "Reread the wording: 'of the students who walk' means the walkers are the denominator, not the whole table.",
    ],
    remember: "The words after 'of the' name your denominator.",
    traps: [
      { key: "Grand total", text: "Using the table's overall total when the question restricted you to a group." },
      { key: "Reversed condition", text: "P(A given B) is not P(B given A)." },
      { key: "Row for column", text: "Taking the wrong margin as the total." },
    ],
  },
  "Inference from sample statistics and margin of error": {
    pattern: "What a sample lets you say about the whole population, and how loosely.",
    why:
      "A sample gives a range, not a number. The margin of error is the width of the honest claim, and a larger sample narrows it because more evidence pins the answer down more tightly.",
    steps: [
      "Build the interval: estimate minus margin, up to estimate plus margin.",
      "A claim is supported only if it lies inside that interval.",
      "A larger sample gives a smaller margin of error. Nothing else in these questions changes that.",
      "Check the sample was random before you generalise at all.",
    ],
    remember: "Bigger sample, narrower interval. The estimate is a range, not a number.",
    traps: [
      { key: "Point estimate as certainty", text: "Treating the sample value as the population's exact value." },
      { key: "Margin backwards", text: "Saying a bigger sample widens the interval." },
      { key: "Wrong population", text: "Generalising to a group the sample was not drawn from." },
    ],
  },
  "Evaluating statistical claims: Observational studies and experiments": {
    pattern: "Two questions only: was the sample random, and were the groups assigned at random?",
    why:
      "Random selection is what lets you talk about the wider population. Random assignment is what lets you talk about cause, because it is the only way to make the groups alike in every other respect. Each buys exactly one thing.",
    steps: [
      "Random selection from a population: you may generalise to that population.",
      "Random assignment to groups: you may claim cause.",
      "Both: cause, for that population. Neither: association only, within the group studied.",
      "Match the strength of the choice to what the design has actually earned.",
    ],
    remember: "Selection buys the population. Assignment buys the cause.",
    traps: [
      { key: "Cause without assignment", text: "An observational study cannot establish cause however large it is." },
      { key: "Overreached population", text: "Volunteers at one school do not stand for all students." },
      { key: "Too weak", text: "Refusing a causal claim when the design was a properly randomised experiment." },
    ],
  },
  "Lines, angles, and triangles": {
    pattern: "Angle facts and similar triangles. Mark the figure as you go.",
    why:
      "These questions are built as chains: each fact you write on the diagram unlocks the next. Nothing has to be held in your head, which is why writing on the figure is the method rather than a habit.",
    steps: [
      "Write every angle you can deduce straight onto the figure.",
      "Parallel lines: corresponding and alternate angles are equal, co-interior angles add to 180°.",
      "Triangle angles sum to 180°. An exterior angle equals the two opposite interior angles.",
      "Two equal angles means the triangles are similar, so set up a proportion of corresponding sides.",
    ],
    remember: "Write on the figure. Never trust how it looks.",
    traps: [
      { key: "Assumed from the picture", text: "Figures are not to scale unless stated. Use only what is marked or given." },
      { key: "Mismatched sides", text: "Pairing sides that are not corresponding in similar triangles." },
      { key: "Isosceles missed", text: "Two equal sides means two equal angles. It is often the unstated step." },
    ],
  },
  "Right triangles and trigonometry": {
    pattern: "SOH-CAH-TOA and the two special triangles. Label the sides from the angle's point of view.",
    why:
      "Opposite and adjacent are not properties of a side; they depend on which angle you are standing at. Relabelling when the question moves to the other angle is not busywork, it is the whole difficulty.",
    steps: [
      "Mark the angle in question, then label opposite, adjacent and hypotenuse from its point of view.",
      "Pick the ratio that uses the two sides you have or want.",
      "Recognise 3-4-5 and 5-12-13, and the 30-60-90 and 45-45-90 ratios. They save the entire calculation.",
      "Remember sin(x) = cos(90 − x): complementary angles swap sine and cosine.",
    ],
    remember: "Opposite and adjacent depend on the angle. Relabel every time you move.",
    traps: [
      { key: "Hypotenuse as a leg", text: "Using the longest side as the adjacent side." },
      { key: "Labels not redrawn", text: "Keeping the first angle's labels when the question moves to the other angle." },
      { key: "Pythagoras without a right angle", text: "It only applies when there is a right angle." },
    ],
  },
  "Area and volume": {
    pattern: "A formula question. The work is choosing the right solid and the right dimension.",
    why:
      "Area is two lengths multiplied and volume is three, which is why scaling every length by k multiplies area by k² and volume by k³. That one idea answers most of the hard questions in this skill.",
    steps: [
      "Name the shape, then write its formula down before substituting anything.",
      "Check radius against diameter. Halve it if you were given the diameter.",
      "Convert so every length is in the same unit before multiplying.",
      "Scaling: lengths × k gives area × k² and volume × k³.",
    ],
    remember: "Radius, not diameter. Check it every single time.",
    traps: [
      { key: "Diameter for radius", text: "The most common slip in this topic by a wide margin." },
      { key: "Mixed units", text: "Centimetres multiplied by metres." },
      { key: "Linear scaling", text: "Doubling every length multiplies volume by eight, not by two." },
    ],
  },
  Circles: {
    pattern: "Centre, radius and angle relationships. The equation hands you the first two.",
    why:
      "(x − h)² + (y − k)² = r² is the distance formula rearranged: every point exactly r away from (h, k). That is why the signs flip and why the number on the right is r² rather than r.",
    steps: [
      "From (x − h)² + (y − k)² = r², the centre is (h, k) with the signs flipped, and the radius is the square root of the right-hand side.",
      "If it is not in that form, complete the square on x and on y.",
      "Arc length and sector area are the fraction of the whole circle given by the central angle over 360°.",
      "An inscribed angle is half the central angle standing on the same arc.",
    ],
    remember: "Signs flip, and the right-hand side is r squared.",
    traps: [
      { key: "Sign of the centre", text: "(x + 3)² means the centre is at x = -3." },
      { key: "r² read as r", text: "The equation ends in 25, so the radius is 5." },
      { key: "Radians", text: "Check whether the angle is in degrees or radians before dividing." },
    ],
    desmos: {
      "scene": "circle",
      "intro": "Reading a circle off the graph instead of off the equation.",
      "steps": [
        {
          "do": "(x-3)^2+(y+2)^2=25",
          "frame": 1,
          "why": "Type the equation exactly as given. Desmos draws the circle, so the centre and radius become things you can see rather than sign rules you have to remember."
        },
        {
          "do": "Find the middle of the circle.",
          "frame": 2,
          "why": "It sits at (3, −2). The signs in the equation are the opposite of the coordinates, which is the thing most often got wrong here.",
          "markers": [
            {
              "at": [
                3,
                -2
              ],
              "label": "centre (3, −2)",
              "place": "left"
            }
          ]
        },
        {
          "do": "Count grid squares from the centre to the edge.",
          "frame": 3,
          "why": "That distance is the radius, 5, which is the square root of the 25 in the equation, not the 25 itself.",
          "markers": [
            {
              "at": [
                5.5,
                -2
              ],
              "label": "radius 5",
              "place": "above"
            }
          ]
        }
      ],
      "reading": "Centre (3, −2), radius 5. If the equation is not in this form, type it in anyway: Desmos completes the square for you and draws the circle regardless."
    },
  },
};

// The coaching for a question, or null when its skill has none.
export function coachingFor(question) {
  return COACHING[question?.skill] ?? null;
}

// A skill can hold more than one kind of question. Nonlinear functions is
// both parabolas and exponential growth; the walkthrough should match the
// question in front of you, not the skill's default. Read the stem, and where
// the words say which, use that scene's walkthrough from another skill.
const SCENE_HINTS = [
  { scene: "exponential", owner: "Nonlinear functions", words: /exponential|percent|decreas(es|ing) by|increas(es|ing) by|growth|decay|doubl|halv|each (year|month|day|hour|week)|per (year|month)/i },
  { scene: "quadratic", owner: "Nonlinear equations in one variable and systems of equations in two variables", words: /parabola|vertex|quadratic|x\^2|x²|squared|minimum|maximum|roots?|zeros?|x-intercepts?/i },
  { scene: "system", owner: "Systems of two linear equations in two variables", words: /system of (two )?(linear )?equations|two equations/i },
  { scene: "circle", owner: "Circles", words: /circle/i },
  { scene: "inequality", owner: "Linear inequalities in one or two variables", words: /inequalit|at least|at most|no more than|no fewer than|fewer than/i },
  { scene: "scatter", owner: "Two-variable data: Models and scatterplots", words: /scatterplot|line of best fit|best fit/i },
];

export function desmosFor(question) {
  const own = coachingFor(question)?.desmos ?? null;
  if (!question || question.section !== "math") return own;
  const text = `${question.stem ?? ""} ${question.prompt ?? ""}`;
  for (const hint of SCENE_HINTS) {
    if (hint.words.test(text)) {
      const walkthrough = COACHING[hint.owner]?.desmos;
      if (walkthrough && walkthrough.scene === hint.scene) return walkthrough;
    }
  }
  return own;
}

// The screenshot for one step of a walkthrough, with each callout already
// placed as a percentage of the image, computed from the bounds the picture
// was drawn with. Returns null when the step names a frame that was never
// captured, so a missing picture can never break the panel.
export function stepPicture(scene, step) {
  const frames = SCENE_FRAMES[scene];
  if (!frames || !step?.frame || step.frame > frames) return null;
  return {
    image: `${scene}-${step.frame}.png`,
    markers: (step.markers ?? []).map((marker) => ({
      ...marker,
      ...pointToPercent(scene, marker.at),
    })),
  };
}

export const SKILLS_COVERED = Object.keys(COACHING);
