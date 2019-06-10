import React from 'react';

import FeaturedImage from '../FeaturedImage';
import H1 from '../H1';
import Wrapper from './Wrapper';
import Link from './Link';
import Date from './Date';

function Summary({date, title, slug, image}) {
  return (
    <Wrapper>
        {image &&
          <Link to={slug}>
            <FeaturedImage sizes={image.childImageSharp.sizes}/>
          </Link>
        }
        <H1><Link to={slug}>{title}</Link></H1>
        <Date>{date}</Date>
    </Wrapper>
  );
}

export default Summary;