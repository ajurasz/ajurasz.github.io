---
title: "equals operator in Groovy"
date: "2019-10-27"
tags: [groovy]
---

If you come from Java land and are lucky enough then you probably write your tests in `Spock` using `Groovy`. Then you already know that `Groovy` allow overriding operators (you can find more about them in [docs](https://groovy-lang.org/operators.html)) and one of them is `==` which in contrast to `Java` does not compare objects reference but their equality through `equals` method.

<!-- end -->

Let's assume we have got following `Java` classes:

```java
public abstract class Event {
	private final timestamp = Instant.now().toEpochMilli();
	
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Event event = (Event) o;
        return timestamp == event.timestamp;
    }

    @Override
    public int hashCode() {
        return Objects.hash(timestamp);
    }	
}

public class ApplicationEvent extends Event {
	private final UUID correlationId;
	
	public ApplicationEvent(UUID correlationId) {
		this.correlationId = correlationId
	}
	
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ApplicationEvent event = (ApplicationEvent) o;
        return corelationId == event.corelationId;
    }

    @Override
    public int hashCode() {
        return Objects.hash(corelationId);
    }	
}
```

If we would write a test for equality I would look something like this: 

```groovy
class ApplicationEventSpec extends Specification {
	def "should recognize equal objects"() {
		given:
		def correlationId = UUID.randomUUID();
		
		expect:
		new ApplicationEvent(correlationId) == new ApplicationEvent(correlationId) // true
	}
} 
```

Above test will start failing after implementing `Comparable` interface on `Event` class.

```java
public abstract class Event implements Comparable<Event> {
    @Override
    public int compareTo(Event o) {
        return Long.compare(timestamp, o.timestamp);
    }	
	
	// rest of the code from the previous snippet stays as it was
}

Unfortunately, I didn't figure what is wrong on my own so I had to look for an explanation on the web. In the official [documentation](http://docs.groovy-lang.org/latest/html/documentation/#_behaviour_of_code_code) I have found the following:

> In Groovy `==` translates to `a.compareTo(b)==0`, if they are `Comparable`, and `a.equals(b)` otherwise.

So there is a single exception for `==` operator which is useful to know. If it comes to failing test it can be fixed by explicitly calling `equals` method.
