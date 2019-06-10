---
title: "Verify your JSON"
date: "2019-06-02"
tags: [jsonpath, testing]
---

When you hear API and web client together you think `REST`, at least I do. This is because it is still one of the most popular architectural paradigms for building APIs. Another approach about which I hear from time to time is `GraphQL`. There is one common part for these two - they talk JSON. Both specifications `REST` and `GraphQL` does not restrict only to this format but due to its simplicity, it is a very common choice. Every healthy software contains tests on different layers, from unit up to the end-to-end tests. So, how could we verify responses from our APIs?

<!-- end -->

In `java` world, especiality in `Spring` ecosystem when it comes to testing APIs you probably saw one of these:

```java
this.mockMvc.perform(get("/hello?name=John"))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.name", is("John")));
```

`jsonPath` static method in the above snippet is a wrapper around great library [JsonPath](https://github.com/json-path/JsonPath). Together with [Hamcrest](https://github.com/hamcrest/JavaHamcrest) it just makes writing test against JSON a true pleasure. 

Note: [JsonPath](https://github.com/json-path/JsonPath) does not require `Spring` it just need some JSON.

I have created simple [playground](https://github.com/ajurasz/jsonpath-playground) for testing different [JsonPath](https://github.com/json-path/JsonPath) expressions. `jsonPath` static method is provided which expects expression, matcher and a JSON string against which expression will be executed.

Let us assume that `json` argument in the following examples will have this structure:

```json
{
  "_id": "5cdaff5fce90bc3ddd98475b",
  "guid": "57cc1cbb-52ba-49ff-af66-4b9dde85a207",
  "isActive": false,
  "a": {
    "b": {
        "c": {
            "d": {
                "e": {
                    "f": "end"
                }
            }
        }
    }
  },
  "f": "other end"
}
```

## Working with JSON objects

Every [JsonPath](https://github.com/json-path/JsonPath) expression starts with `$` symbol which represents **root** element (no matter if the JSON structure is an object or array). When you want to access the specific property you have two choices - dot or bracket notation. 

```java
//dot notation
jsonPath("$.guid", is("57cc1cbb-52ba-49ff-af66-4b9dde85a207")).runAgainst(json);
jsonPath("$.isActive", isA(Boolean.class)).runAgainst(json);
jsonPath("$.age", instanceOf(Number.class)).runAgainst(json);
jsonPath("$.nonExisting", nullValue());
jsonPath("$.name.first", is("Opal")).runAgainst(json);

//bracket notation
jsonPath("$['guid']", is("57cc1cbb-52ba-49ff-af66-4b9dde85a207")).runAgainst(json);
jsonPath("$['isActive']", isA(Boolean.class)).runAgainst(json);
jsonPath("$['name']['first']", is("Opal")).runAgainst(json);
```

Although the second approach is noisier it is useful in situation when property name contains special characters or starts with a character other than represented by this regular expression `/[a-zA-Z_]/`.

We can also do a deep scan to access property in very nested object. To acccess `f` property in our sample we could:

```java
jsonPath("$..f", hasItems("end", "other-end")).runAgainst(json);

// or using standard dot notation
jsonPath("$.a.b.c.d.e.f", is("end")).runAgainst(json);
```

Notice that deep scann returns array of values because depending on JSON structure it can find more properties with the name `f`. We can narrow down what path will be part of a deep scan by pointing to spefici property from which deep scan starts:

```java
jsonPath("$.a..f", hasItems("end")).runAgainst(json);
```

## Working with JSON arrays

Let us assume that `json` argument in the following examples will have this structure:

```json
{
  "friends": [
    {
      "id": 0,
      "name": "Hester Dallai",
      "age": 31
    },
    {
      "id": 1,
      "name": "Lucinda Goff",
      "age": 27
    },
    {
      "id": 2,
      "name": "Ella Day",
      "age": 17
    }
  ],
  "adult": 18
}
```

To access the single property from an object inside array you use square brackets just like in `java`.

```java
jsonPath("$.friends[0].id", is(0)).runAgainst(json);
```

[JsonPath](https://github.com/json-path/JsonPath) expressions support wildcards (`*`) which selects all elements in both object and arrays. 

To verify the age of our friends we can:

```java
jsonPath("$.friends[*].age", hasItems(31, 27, 17)).runAgainst(json);
```

When you have ever worked with `python` you probably came across slice notation, which in some part is supported in [JsonPath](https://github.com/json-path/JsonPath).

```python
[start:stop]     # from start to stop - 1
[start:]         # from start to the end of array
[:n]             # selects first n - 1 elements
[-n:]            # selects last n elements
```

Knowing this slice expressions would like like this:

```java
jsonPath("$.friends[:3].age", hasItems(31, 27)).runAgainst(json);
jsonPath("$.friends[1:2].age", hasItems(27)).runAgainst(json);
jsonPath("$.friends[:2].age", hasItems(31, 27)).runAgainst(json);
jsonPath("$.friends[-2:].age", hasItems(17, 27)).runAgainst(json);
```

## Filter expression

Next powerful feature of [JsonPath](https://github.com/json-path/JsonPath) are filter expression `[?(<expression>)]` which make selection of elements more dynamic. Complete list of supported operators can be found at [https://github.com/json-path/JsonPath#filter-operators](https://github.com/json-path/JsonPath#filter-operators).

```java
jsonPath("$.friends[?(@.age >= 18)].id", hasItems(0, 1)).runAgainst(json);
jsonPath("$.friends[?(@.id == 1)].age", hasItems(27)).runAgainst(json);
jsonPath("$.friends[?(@.id != 1)].age", hasItems(31, 17)).runAgainst(json);
jsonPath("$.friends[?(@.age in [31, 17])].id", hasItems(0, 2)).runAgainst(json);
jsonPath("$.friends[?(@.name =~ /^.*Da.*$/i)].id", hasItems(0, 2)).runAgainst(json);
```

`@` represent the current node. In the above example this will represent friend node and for each of our friends (`$.friends[]`), given property will be returned when the expression evaluates to true.

We can be even more dynamic by referencing to other properties:

```java
jsonPath("$.friends[?(@.age >= 18)].id", hasItems(0, 1)).runAgainst(json);
jsonPath("$.friends[?(@.age >= $.adult)].id", hasItems(0, 1)).runAgainst(json);
```

## Functions

[JsonPath](https://github.com/json-path/JsonPath) provides functions that can be added at the end of our expression. The rule is simple  - output of expression is input to the function. Complete list of build in functions can be found at [https://github.com/json-path/JsonPath#functions](https://github.com/json-path/JsonPath#functions).

Let us assume that `json` argument in the following examples will have this structure:

```json
{
  "range": [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9
  ]
}
```

then we can run functions that expects arrays as input

```java
jsonPath("$.range.avg()", is(4.5)).runAgainst(json);
jsonPath("$.range.min()", is(0.0)).runAgainst(json);
jsonPath("$.range.max()", is(9.0)).runAgainst(json);
jsonPath("$.range.stddev()", is(2.8722813232690143)).runAgainst(json);
jsonPath("$.range.length()", is(10)).runAgainst(json);
```

## Conclusion

As you saw [JsonPath](https://github.com/json-path/JsonPath) expressions are very powerful, they should be able to extract whatever you want from a JSON structure. All used examples and more can be found on [github](https://github.com/ajurasz/jsonpath-playground).
